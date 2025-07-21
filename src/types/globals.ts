export type FunctionResponse = {
  status: boolean;
  message: string;
  data: Record<string, any>;
};

export type RequestPayload = {
  data: Record<string, any>;
};
