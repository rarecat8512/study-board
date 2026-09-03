declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: number;
        sessionId: string;
        email: string;
        name: string;
      };
    }
  }
}

export {};
