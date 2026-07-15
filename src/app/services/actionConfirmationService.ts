import { Action } from '../../interfaces/schemas/genericMessageSchema';

export interface PendingAction {
  id: string;
  userId: string;
  action: Action;
  expiresAt: Date;
  createdAt: Date;
}

export class ActionConfirmationService {
  private pendingActions: Map<string, PendingAction> = new Map();
  private confirmationTimeout: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Create a pending action awaiting confirmation
   */
  async createPendingAction(userId: string, action: Action): Promise<PendingAction> {
    const pendingAction: PendingAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      action,
      expiresAt: new Date(Date.now() + this.confirmationTimeout),
      createdAt: new Date(),
    };

    this.pendingActions.set(pendingAction.id, pendingAction);
    
    // Clean up expired actions periodically
    this.cleanupExpiredActions();

    return pendingAction;
  }

  /**
   * Get a pending action by ID
   */
  async getPendingAction(actionId: string): Promise<PendingAction | null> {
    const action = this.pendingActions.get(actionId);
    
    if (!action) {
      return null;
    }

    // Check if expired
    if (new Date() > action.expiresAt) {
      this.pendingActions.delete(actionId);
      return null;
    }

    return action;
  }

  /**
   * Confirm a pending action
   */
  async confirmAction(actionId: string): Promise<Action | null> {
    const pendingAction = await this.getPendingAction(actionId);
    
    if (!pendingAction) {
      return null;
    }

    // Remove from pending
    this.pendingActions.delete(actionId);

    return pendingAction.action;
  }

  /**
   * Cancel a pending action
   */
  async cancelAction(actionId: string): Promise<boolean> {
    const pendingAction = await this.getPendingAction(actionId);
    
    if (!pendingAction) {
      return false;
    }

    this.pendingActions.delete(actionId);
    return true;
  }

  /**
   * Get all pending actions for a user
   */
  async getUserPendingActions(userId: string): Promise<PendingAction[]> {
    return Array.from(this.pendingActions.values()).filter(
      action => action.userId === userId && new Date() <= action.expiresAt
    );
  }

  /**
   * Clean up expired actions
   */
  private cleanupExpiredActions(): void {
    const now = new Date();
    
    for (const [id, action] of this.pendingActions.entries()) {
      if (now > action.expiresAt) {
        this.pendingActions.delete(id);
      }
    }
  }

  /**
   * Generate confirmation message
   */
  generateConfirmationMessage(action: Action): string {
    const actionData = action.data;
    
    switch (action.type) {
      case 'create_expense':
        if (actionData && actionData.tipo_transacao === 'debit') {
          return `Confirme o gasto de R$ ${actionData.valor?.toFixed(2)} em ${actionData.categoria}? (Responda "sim" para confirmar ou "não" para cancelar)`;
        } else if (actionData) {
          return `Confirme a receita de R$ ${actionData.valor?.toFixed(2)} em ${actionData.categoria}? (Responda "sim" para confirmar ou "não" para cancelar)`;
        } else {
          return 'Confirme a ação? (Responda "sim" para confirmar ou "não" para cancelar)';
        }
      
      case 'get_report':
        if (actionData) {
          return `Gerando relatório ${actionData.periodo}${actionData.filtro_categoria ? ` para ${actionData.filtro_categoria}` : ''}...`;
        } else {
          return 'Gerando relatório...';
        }
      
      default:
        return 'Ação não reconhecida.';
    }
  }

  /**
   * Parse user response for confirmation
   */
  parseConfirmationResponse(text: string): boolean | null {
    const normalizedText = text.toLowerCase().trim();
    
    const positiveResponses = ['sim', 'yes', 'y', 'ok', 'confirmar', 'confirm'];
    const negativeResponses = ['não', 'nao', 'no', 'n', 'cancelar', 'cancel'];
    
    if (positiveResponses.includes(normalizedText)) {
      return true;
    }
    
    if (negativeResponses.includes(normalizedText)) {
      return false;
    }
    
    return null; // Ambiguous response
  }
}
