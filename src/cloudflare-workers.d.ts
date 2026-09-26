interface DurableObjectState {}

interface DurableObjectNamespace {
  idFromName(name: string): string;
  get(id: string): {
    fetch(request: Request): Promise<Response>;
  };
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;

  constructor();
}

interface ResponseInit {
  webSocket?: WebSocket;
}

interface WebSocket {
  accept(): void;
}