"""Course MCP adapter. Tool signatures are derived from the reviewed contract."""
import inspect
import jsonschema
from pathlib import Path
from typing import Annotated, Literal
from pydantic import Field
from mcp.server import MCPServer
from mcp.types import CallToolResult
from adapter import CONTRACT, call_api

class ContractMCPServer(MCPServer):
    """Preserve the wire contract before Pydantic can coerce or discard input."""
    async def list_tools(self):
        return [tool.model_copy(update={'input_schema':CONTRACT[tool.name]['inputSchema']}) for tool in await super().list_tools()]

    async def call_tool(self, name, arguments, context=None):
        if name not in CONTRACT:
            return CallToolResult(content=[{'type':'text','text':'Unknown tool.'}],is_error=True)
        try:
            jsonschema.validate(arguments,CONTRACT[name]['inputSchema'])
        except jsonschema.ValidationError:
            return CallToolResult(content=[{'type':'text','text':'INVALID_INPUT: Arguments do not match the published tool schema.'}],is_error=True)
        return await super().call_tool(name,arguments,context)

mcp = ContractMCPServer('shop-search-recommendations')

def register(name, definition):
    def handler(**arguments):
        return CallToolResult.model_validate(call_api(name,arguments))
    handler.__name__=name
    handler.__doc__=definition['description']
    schema=definition['inputSchema']
    required=schema.get('required',[])
    parameters=[]
    annotations={'return':CallToolResult}
    for key, value in sorted(schema['properties'].items(),key=lambda item:item[0] not in required):
        annotation=Literal[tuple(value['enum'])] if 'enum' in value else int if value.get('type') in ('integer','number') else str
        default=value.get('default',inspect.Parameter.empty if key in required else None)
        if default is None:
            annotation=annotation | None
        constraints={python:value[json_key] for json_key,python in [('minimum','ge'),('maximum','le'),('minLength','min_length'),('maxLength','max_length')] if json_key in value}
        annotation=Annotated[annotation,Field(description=value.get('description',''),**constraints)]
        annotations[key]=annotation
        parameters.append(inspect.Parameter(key,inspect.Parameter.KEYWORD_ONLY,annotation=annotation,default=default))
    handler.__annotations__=annotations
    handler.__signature__=inspect.Signature(parameters,return_annotation=CallToolResult)
    mcp.tool(name=name,description=definition['description'],structured_output=False)(handler)

for name,definition in CONTRACT.items():
    register(name,definition)

@mcp.resource('erp://search-recommendations/openapi')
def openapi_spec() -> str:
    """Read the reviewed OpenAPI 3.1 contract for Search & Recommendations."""
    return (Path(__file__).resolve().parents[2]/'docs/search-recommendations/session-5-mcp/openapi.yaml').read_text()

if __name__=='__main__':
    mcp.run(transport='stdio')
