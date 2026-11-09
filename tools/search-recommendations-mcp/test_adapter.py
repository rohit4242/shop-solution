import json
import httpx
from adapter import call_api, CONTRACT

def test_error_and_encoded_parameters():
    seen=[]
    def handle(request):
        seen.append(request)
        return httpx.Response(404,json={'error':{'code':'PRODUCT_NOT_FOUND','message':'Product not found.'}},headers={'x-request-id':'r1'})
    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        value=call_api('similar',{'productId':'a & b'},client=client)
    assert len(seen)==1
    assert seen[0].url.params['productId']=='a & b'
    assert value['isError'] is True
    assert json.loads(value['content'][0]['text'])['status']==404

def test_connection_errors_do_not_expose_exception():
    def handle(request):
        raise httpx.ConnectError('secret',request=request)
    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        value=call_api('search',{},client=client)
    assert 'secret' not in str(value)
    assert json.loads(value['content'][0]['text'])['error']['code']=='CONNECTION_FAILED'

def test_contract_has_five_tools():
    assert list(CONTRACT)==['search','facets','autocomplete','similar','also_bought']

def test_protocol_boundary_rejects_coercions_and_extras_before_http(monkeypatch):
    import asyncio
    import server
    seen=[]
    monkeypatch.setattr(server,'call_api',lambda *args,**kwargs:seen.append(args) or {'content':[{'type':'text','text':'ok'}],'isError':False})
    async def check():
        for arguments in [{'page':'5'}, {'unexpected':'discarded'}, {'category':None}]:
            result=await server.mcp.call_tool('search',arguments)
            assert result.is_error
        tools=await server.mcp.list_tools()
        for tool in tools:
            assert tool.input_schema==CONTRACT[tool.name]['inputSchema']
    asyncio.run(check())
    assert seen==[]
