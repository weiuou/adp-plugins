export declare function dimSessionId(session: string, branch: string): string;
export declare function createDimPlugin(sdk: unknown): {
  name: string;
  inject: string[];
  apply(ctx: any): Promise<void>;
};
