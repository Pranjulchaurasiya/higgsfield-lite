import { NextRequest, NextResponse } from 'next/server';
import { createGenerationJob, getGenerationJob } from '@/lib/jobs';
import { getCreditBalance, getCreditLedger } from '@/lib/credits';
import { supabase, DEMO_USER_ID } from '@/lib/supabase';

// Model Context Protocol (MCP) JSON-RPC 2.0 Server Endpoint
// Compatible with Cursor, Claude Desktop, Windsurf, and custom AI agents

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const MCP_TOOLS = [
  {
    name: 'atelier_generate_image',
    description: 'Trigger an AI image generation using Cloudflare Workers AI FLUX Schnell with verifiable demo credit ledger tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The descriptive text prompt for the image generation.',
        },
        aspect_ratio: {
          type: 'string',
          enum: ['1:1', '16:9', '9:16'],
          default: '1:1',
          description: 'The target aspect ratio for the image.',
        },
        simulate_failure: {
          type: 'boolean',
          default: false,
          description: 'If true, simulates a provider failure to verify the automatic credit refund ledger mechanism.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'atelier_get_credits',
    description: 'Get the current demo wallet credit balance and recent ledger audit transactions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'atelier_list_assets',
    description: 'List recently generated images and sample media stored in the asset library.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          default: 10,
          description: 'Maximum number of assets to retrieve.',
        },
      },
    },
  },
  {
    name: 'atelier_get_job_status',
    description: 'Poll or check the current status of an ongoing or completed image generation job.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'string',
          description: 'The unique UUID of the generation job.',
        },
      },
      required: ['job_id'],
    },
  },
];

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const endpointUrl = `${protocol}://${host}/api/mcp`;

  return NextResponse.json({
    name: 'Atelier Generative Studio MCP Server',
    version: '1.0.0',
    description: 'Model Context Protocol (MCP) server for programmatic image generation with Cloudflare FLUX Schnell and verifiable credit ledgers.',
    endpoint: endpointUrl,
    tools: MCP_TOOLS,
    cursor_config: {
      mcpServers: {
        atelier: {
          url: endpointUrl,
        },
      },
    },
    claude_desktop_config: {
      mcpServers: {
        atelier: {
          command: 'npx',
          args: ['-y', 'mcp-remote', endpointUrl],
        },
      },
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as JsonRpcRequest;
    const { id, method, params } = body;

    // Handle standard MCP JSON-RPC protocol methods
    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'atelier-generative-mcp',
            version: '1.0.0',
          },
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
        },
      });
    }

    if (method === 'notifications/initialized') {
      return new NextResponse(null, { status: 204 });
    }

    if (method === 'ping') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {},
      });
    }

    if (method === 'tools/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          tools: MCP_TOOLS,
        },
      });
    }

    if (method === 'tools/call') {
      const toolName = (params as { name?: string })?.name;
      const toolArgs = ((params as { arguments?: Record<string, unknown> })?.arguments) || {};

      switch (toolName) {
        case 'atelier_generate_image': {
          const prompt = String(toolArgs.prompt || '').trim();
          if (!prompt) {
            return NextResponse.json({
              jsonrpc: '2.0',
              id: id ?? null,
              error: { code: -32602, message: 'Invalid params: prompt is required.' },
            });
          }
          const aspectRatio = String(toolArgs.aspect_ratio || '1:1');
          const forcedFailure = Boolean(toolArgs.simulate_failure);
          const idempotencyKey = crypto.randomUUID();

          const result = await createGenerationJob({
            prompt,
            aspectRatio,
            idempotencyKey,
            forcedFailure,
            userId: DEMO_USER_ID,
          });

          if (!result.success || !result.job) {
            return NextResponse.json({
              jsonrpc: '2.0',
              id: id ?? null,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `Generation request failed: ${result.error || 'Unknown error'}`,
                  },
                ],
                isError: true,
              },
            });
          }

          return NextResponse.json({
            jsonrpc: '2.0',
            id: id ?? null,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      job_id: result.job.id,
                      status: result.job.state,
                      prompt: result.job.prompt,
                      aspect_ratio: result.job.aspect_ratio,
                      created_at: result.job.created_at,
                      cost: '1 demo credit',
                      note: 'Job is processing asynchronously via Cloudflare FLUX Schnell. Check status with atelier_get_job_status.',
                    },
                    null,
                    2
                  ),
                },
              ],
            },
          });
        }

        case 'atelier_get_credits': {
          const { balance, transactions } = await getCreditLedger(DEMO_USER_ID);
          return NextResponse.json({
            jsonrpc: '2.0',
            id: id ?? null,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      balance,
                      wallet_owner: 'demo_creator',
                      recent_transactions: transactions.slice(0, 5),
                    },
                    null,
                    2
                  ),
                },
              ],
            },
          });
        }

        case 'atelier_list_assets': {
          const limit = Math.min(Number(toolArgs.limit) || 10, 50);
          const { data, error } = await supabase
            .from('assets')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

          const assets = error ? [] : (data || []);
          return NextResponse.json({
            jsonrpc: '2.0',
            id: id ?? null,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      count: assets.length,
                      assets: assets.map((a) => ({
                        id: a.id,
                        prompt: a.prompt,
                        aspect_ratio: a.aspect_ratio,
                        url: a.url || a.storage_object_key,
                        is_sample: a.is_sample,
                        created_at: a.created_at,
                      })),
                    },
                    null,
                    2
                  ),
                },
              ],
            },
          });
        }

        case 'atelier_get_job_status': {
          const jobId = String(toolArgs.job_id || '');
          if (!jobId) {
            return NextResponse.json({
              jsonrpc: '2.0',
              id: id ?? null,
              error: { code: -32602, message: 'Invalid params: job_id is required.' },
            });
          }

          const job = await getGenerationJob(jobId);
          if (!job) {
            return NextResponse.json({
              jsonrpc: '2.0',
              id: id ?? null,
              result: {
                content: [{ type: 'text', text: `Job not found: ${jobId}` }],
                isError: true,
              },
            });
          }

          return NextResponse.json({
            jsonrpc: '2.0',
            id: id ?? null,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      id: job.id,
                      state: job.state,
                      prompt: job.prompt,
                      aspect_ratio: job.aspect_ratio,
                      created_at: job.created_at,
                      completed_at: job.completed_at,
                      safe_error_summary: job.safe_error_summary,
                      asset: job.asset,
                    },
                    null,
                    2
                  ),
                },
              ],
            },
          });
        }

        default:
          return NextResponse.json({
            jsonrpc: '2.0',
            id: id ?? null,
            error: { code: -32601, message: `Method or tool not found: ${toolName}` },
          });
      }
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32601, message: `Unsupported method: ${method}` },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message },
      },
      { status: 500 }
    );
  }
}
