/**
 * Express Type Declarations
 * Local type definitions to avoid @types/express compatibility issues with Express v5
 */

declare module 'express' {
  import { Server } from 'http';
  import { IncomingMessage, ServerResponse } from 'http';

  export interface Request {
    body: any;
    query: Record<string, any>;
    params: Record<string, string>;
    headers: Record<string, string | string[] | undefined>;
    method: string;
    url: string;
    path: string;
    baseUrl: string;
    originalUrl: string;
    protocol: string;
    secure: boolean;
    ip: string;
    ips: string[];
    hostname: string;
    cookies: Record<string, string>;
    signedCookies: Record<string, string>;
    socket: { remoteAddress?: string };
    get: (name: string) => string | undefined;
    header: (name: string) => string | undefined;
    accepts: (type: string | string[]) => string | false;
    is: (type: string | string[]) => string | false | null;
    user?: User;
    rateLimit?: {
      resetTime?: number;
      limit?: number;
      remaining?: number;
      used?: number;
    };
  }

  export interface Response {
    status: (code: number) => Response;
    json: (body: any) => Response;
    send: (body?: any) => Response;
    sendStatus: (code: number) => Response;
    sendFile: (path: string, options?: any, fn?: (err?: Error) => void) => void;
    render: (view: string, options?: any, callback?: (err: Error, html: string) => void) => void;
    redirect: (url: string) => void;
    redirect: (status: number, url: string) => void;
    set: (field: string, value?: string | string[]) => Response;
    setHeader: (name: string, value: string | number | readonly string[]) => Response;
    removeHeader: (name: string) => void;
    getHeader: (name: string) => string | number | string[] | undefined;
    header: (field: string, value?: string | string[]) => Response;
    type: (type: string) => Response;
    cookie: (name: string, value: string | object, options?: CookieOptions) => Response;
    clearCookie: (name: string, options?: CookieOptions) => Response;
    attachment: (filename?: string) => Response;
    append: (field: string, value?: string | string[]) => Response;
    locals: Record<string, any>;
    headersSent: boolean;
    statusCode: number;
    on: (event: string, callback: (...args: any[]) => void) => Response;
    end: (chunk?: any, encoding?: string) => Response;
  }

  export interface NextFunction {
    (err?: any): void;
  }

  export interface CookieOptions {
    maxAge?: number;
    signed?: boolean;
    expires?: Date;
    httpOnly?: boolean;
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: boolean | 'lax' | 'strict' | 'none';
  }

  export interface RouterOptions {
    caseSensitive?: boolean;
    mergeParams?: boolean;
    strict?: boolean;
  }

  export interface Router {
    (req: Request, res: Response, next: NextFunction): void;
    all: IRouterMatcher<this>;
    get: IRouterMatcher<this>;
    post: IRouterMatcher<this>;
    put: IRouterMatcher<this>;
    delete: IRouterMatcher<this>;
    patch: IRouterMatcher<this>;
    options: IRouterMatcher<this>;
    head: IRouterMatcher<this>;
    use: IRouterHandler<this> & IRouterMatcher<this>;
    route: (path: string) => IRoute;
    param: (name: string, handler: RequestParamHandler) => this;
  }

  export interface IRoute {
    all: IRouterHandler<this>;
    get: IRouterHandler<this>;
    post: IRouterHandler<this>;
    put: IRouterHandler<this>;
    delete: IRouterHandler<this>;
    patch: IRouterHandler<this>;
    options: IRouterHandler<this>;
    head: IRouterHandler<this>;
  }

  export interface IRouterMatcher<T> {
    (path: PathParams, ...handlers: RequestHandler[]): T;
  }

  export interface IRouterHandler<T> {
    (...handlers: RequestHandler[]): T;
  }

  export type PathParams = string | RegExp | Array<string | RegExp>;

  export type RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => void | Promise<void>;

  export type ErrorRequestHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ) => void | Promise<void>;

  export type RequestParamHandler = (
    req: Request,
    res: Response,
    next: NextFunction,
    value: string,
    name: string
  ) => void;

  export interface Application extends Router {
    listen: (port: number, callback?: () => void) => Server;
    listen: (port: number, hostname: string, callback?: () => void) => Server;
    set: (setting: string, val: any) => Application;
    get: ((setting: string) => any) & IRouterMatcher<this>;
    enable: (setting: string) => Application;
    disable: (setting: string) => Application;
    enabled: (setting: string) => boolean;
    disabled: (setting: string) => boolean;
    engine: (ext: string, fn: (path: string, options: object, callback: (e: any, rendered?: string) => void) => void) => Application;
    locals: Record<string, any>;
    mountpath: string | string[];
    on: (event: string, callback: (...args: any[]) => void) => Application;
  }

  export interface Express {
    (): Application;
    Router: (options?: RouterOptions) => Router;
    json: (options?: any) => RequestHandler;
    urlencoded: (options?: any) => RequestHandler;
    static: (root: string, options?: any) => RequestHandler;
    raw: (options?: any) => RequestHandler;
    text: (options?: any) => RequestHandler;
    application: Application;
    request: Request;
    response: Response;
  }

  const express: Express;
  export default express;
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string | null;
      createdAt: Date;
      preferences?: any;
      avatar?: string;
      authProvider?: string;
      googleId?: string;
    }

    interface Request {
      user?: User;
      rateLimit?: {
        resetTime?: number;
        limit?: number;
        remaining?: number;
        used?: number;
      };
    }
  }
}

// Additional type for authenticated requests
export interface AuthenticatedRequest extends Express.Request {
  user: Express.User;
  headers: any;
}
