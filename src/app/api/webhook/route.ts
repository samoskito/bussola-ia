/**
 * API para receber respostas do n8n
 * 
 * Este endpoint recebe as respostas geradas pelo n8n e as processa,
 * atualizando o banco de dados e notificando o usuário.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processWebhookResponse } from '@/lib/webhook';

export async function POST(request: NextRequest) {
  try {
    // Verificar se a requisição é válida
    if (!request.body) {
      return NextResponse.json(
        { success: false, message: 'Corpo da requisição vazio' },
        { status: 400 }
      );
    }

    // Obter dados da requisição
    const data = await request.json();

    // Verificar se os dados necessários estão presentes
    if (!data.webhook_id || !data.output) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Dados incompletos. webhook_id e output são obrigatórios' 
        },
        { status: 400 }
      );
    }

    // Processar resposta do webhook
    const result = await processWebhookResponse(data.webhook_id, data.output);

    // Retornar resultado
    if (result.success) {
      return NextResponse.json(
        { success: true, message: 'Resposta processada com sucesso' },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erro ao processar resposta do webhook:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}

// Desabilitar o body parsing para permitir o upload de arquivos
export const config = {
  api: {
    bodyParser: false,
  },
};
