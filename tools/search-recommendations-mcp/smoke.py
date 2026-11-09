"""Protocol/HTTP smoke evidence, not an autonomous model run."""
import asyncio,json,sys,os
from pathlib import Path
from mcp import Client, StdioServerParameters

async def check(label,server):
    async with Client(server) as client:
        tools=(await client.list_tools()).tools
        assert {tool.name for tool in tools}=={'search','facets','autocomplete','similar','also_bought'}
        for args in [{'page':'5'},{'unexpected':'discarded'},{'category':None}]:
            invalid=await client.call_tool('search',args)
            assert invalid.is_error, (label,args)
        print(json.dumps({'type':'invalid-input-parity','transport':label,'cases':3,'rejected':3}))
        resource=await client.read_resource('erp://search-recommendations/openapi')
        assert 'openapi: 3.1.0' in resource.contents[0].text
        print(json.dumps({'type':'discovery','transport':label,'tools':[t.name for t in tools],'resource':'ok'}))
        for name,args in [('search',{'q':'wireless','availability':'in_stock','maxPriceMinor':2500}),('facets',{'q':'wireless'}),('autocomplete',{'q':'wire'}),('similar',{'productId':'prd_1'}),('also_bought',{'productId':'prd_1'}),('similar',{'productId':'prd_missing'}),('also_bought',{'productId':'prd_5'})]:
            result=await client.call_tool(name,args)
            body=json.loads(result.content[0].text)
            assert body['status']==(404 if args.get('productId')=='prd_missing' else 200),body
            if name=='search':assert body['body']['data']['items'][0]['productId']=='prd_1'
            if args.get('productId')=='prd_5':assert body['body']['data']['items']==[]
            print(json.dumps({'transport':label,'name':name,'arguments':args,'result':body,'isError':result.is_error}))

async def main():
    await check('stdio',StdioServerParameters(command=sys.executable,args=[str(Path(__file__).with_name('server.py'))],env={**os.environ}))
    await check('http',os.environ.get('SEARCH_MCP_URL','http://127.0.0.1:3000/api/mcp/search-recommendations'))
if __name__=='__main__':asyncio.run(main())
