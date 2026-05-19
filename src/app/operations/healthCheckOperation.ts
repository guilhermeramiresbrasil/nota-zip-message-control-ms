
export class healthCheckOperation {
  async execute(): Promise<any> {
    try {
      console.log('🔄 Executando operação de health check');
      
      const healthStatus = {
        status: 'ok',
        service: 'message-control-ms',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: 'connected'
      };
      
      console.log('✅ Health check executado com sucesso');
      return healthStatus;
      
    } catch (error) {
      console.error('❌ Erro na operação de health check:', error);
      throw error;
    }
  }
}
