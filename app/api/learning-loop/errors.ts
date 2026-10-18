import { NextResponse } from 'next/server';
import { LearningLoopError } from '@/lib/learning-loop/store';
import { logger } from '@/lib/logger';

const STATUS = {
  NOT_PROVISIONED: 503,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID: 400,
} as const;

export function loopErrorResponse(error: unknown, where: string): NextResponse {
  if (error instanceof LearningLoopError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: STATUS[error.code] }
    );
  }
  logger.error(`learning-loop ${where} failed`, {
    error: error instanceof Error ? error.message : String(error),
  });
  return NextResponse.json(
    { error: 'Learning loop request failed' },
    { status: 500 }
  );
}
