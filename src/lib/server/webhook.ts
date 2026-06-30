import { createServerSupabaseClient } from '@/lib/supabase/server';

const supabase = createServerSupabaseClient();

export const processScriptWebhookResponse = async (scriptId: string | number, output: string) => {
  try {
    const { error } = await supabase
      .from('scripts')
      .update({
        output,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scriptId);

    if (error) {
      throw new Error(`Erro ao atualizar script: ${error.message}`);
    }

    return {
      success: true,
      message: 'Resposta do script processada com sucesso',
    };
  } catch (error) {
    console.error('Erro ao processar resposta por scriptId:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
};

export const processWebhookResponse = async (webhook_id: string, output: string) => {
  try {
    const { error } = await supabase
      .from('outputs')
      .update({
        output,
        status: 'concluido',
        updated_at: new Date().toISOString(),
      })
      .eq('webhook_id', webhook_id);

    if (error) {
      throw new Error(`Erro ao atualizar output: ${error.message}`);
    }

    const { data: outputData, error: outputError } = await supabase
      .from('outputs')
      .select('id, user_id, chat_id')
      .eq('webhook_id', webhook_id)
      .single();

    if (outputError || !outputData) {
      throw new Error(`Erro ao buscar dados do output: ${outputError?.message || 'Output nao encontrado'}`);
    }

    const { error: messageError } = await supabase
      .from('mensagens')
      .insert({
        chat_id: outputData.chat_id,
        user_id: outputData.user_id,
        tipo: 'assistente',
        conteudo: output,
      });

    if (messageError) {
      throw new Error(`Erro ao registrar mensagem: ${messageError.message}`);
    }

    return {
      success: true,
      message: 'Resposta processada com sucesso',
    };
  } catch (error) {
    console.error('Erro ao processar resposta do webhook:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
};
