"""Thin HTTP translation; generated contract is the source for tool schemas."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse
import httpx
import jsonschema

ROOT = Path(__file__).resolve().parent
CONTRACT = json.loads((ROOT / 'tool-contract.json').read_text())

def call_api(name, arguments, *, client=None):
    definition = CONTRACT[name]
    arguments = {**{key:value['default'] for key,value in definition['inputSchema']['properties'].items() if 'default' in value}, **{k:v for k,v in arguments.items() if v is not None}}
    jsonschema.validate(arguments, definition['inputSchema'])
    origin = os.environ.get('SEARCH_API_BASE_URL', 'http://127.0.0.1:3000')
    parsed = urlparse(origin)
    if parsed.scheme not in ('http','https') or not parsed.netloc or parsed.username or parsed.password or parsed.path not in ('','/') or parsed.query or parsed.fragment:
        raise ValueError('SEARCH_API_BASE_URL must be an HTTP(S) origin.')
    request = {'method':'GET','path':definition['path'],'query':{k:str(v) for k,v in arguments.items()}}
    owned = client is None
    if owned:
        client = httpx.Client(timeout=10,follow_redirects=False)
    try:
        response = client.get(origin.rstrip('/')+definition['path'],params=arguments,timeout=10,follow_redirects=False,headers={"x-vercel-protection-bypass":os.environ["VERCEL_AUTOMATION_BYPASS_SECRET"]} if os.environ.get("VERCEL_AUTOMATION_BYPASS_SECRET") else None)
        payload = {'request':request,'status':response.status_code,'requestId':response.headers.get('x-request-id')}
        try:
            payload['body'] = response.json()
            failed = not response.is_success
        except ValueError:
            payload['error']={'code':'INVALID_UPSTREAM_RESPONSE','message':'API returned invalid JSON.'}
            failed=True
    except httpx.RequestError as error:
        code='TIMEOUT' if isinstance(error,httpx.TimeoutException) else 'CONNECTION_FAILED'
        payload={'request':request,'status':None,'requestId':None,'error':{'code':code,'message':'API request exceeded 10 seconds.' if code=='TIMEOUT' else 'Could not connect to the discovery API.'}}
        failed=True
    finally:
        if owned:
            client.close()
    return {'content':[{'type':'text','text':json.dumps(payload)}],'isError':failed}
