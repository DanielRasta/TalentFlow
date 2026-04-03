import db from '../db';
import { Request, Response, NextFunction } from 'express';

export function checkExpiredCandidates(): void {
  const result = db
    .prepare(
      "UPDATE candidates SET is_active = 0 WHERE expires_at < datetime('now') AND is_active = 1"
    )
    .run();

  if (result.changes > 0) {
    console.log(`Deactivated ${result.changes} expired candidate(s)`);
  }
}

export function expiryMiddleware(req: Request, res: Response, next: NextFunction): void {
  checkExpiredCandidates();
  next();
}
