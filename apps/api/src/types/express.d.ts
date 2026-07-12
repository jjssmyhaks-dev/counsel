declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        firmId: string;
        role: string;
      };
      firmId?: string;
    }
  }
}

export {};
