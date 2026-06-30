import { NextRequest, NextResponse } from 'next/server';
import { processScriptWebhookResponse, processWebhookResponse } from '@/lib/server/webhook';

export async function POST(request: NextRequest) {
  try {
    if (!request.body) {
      return NextResponse.json(
        { success: false, message: 'Corpo da requisicao vazio' },
        { status: 400 }
      );
    }

    const data = await request.json();
    const scriptId = data.scriptId ?? data.script_id;
    const webhookId = data.webhook_id;
    const output = data.output ?? data.response ?? data.resposta ?? data.message;

    if ((!scriptId && !webhookId) || !output) {
      return NextResponse.json(
        {
          success: false,
          message: 'Dados incompletos. scriptId e output sao obrigatorios no fluxo ativo',
        },
        { status: 400 }
      );
    }

    const result = scriptId
      ? await processScriptWebhookResponse(scriptId, output)
      : await processWebhookResponse(webhookId, output);

    if (result.success) {
      return NextResponse.json(
        { success: true, message: 'Resposta processada com sucesso' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: false, message: result.message },
      { status: 500 }
    );
  } catch (error) {
    console.error('Erro ao processar resposta do webhook:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
