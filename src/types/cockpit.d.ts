declare module 'cockpit' {
  interface File {
    read(): Promise<string>;
    replace(content: string): Promise<void>;
    access(): Promise<void>;
  }

  interface SpawnOptions {
    err?: 'out' | 'message' | 'ignore';
    environ?: string[];
  }

  interface SpawnProcess {
    stream(callback: (data: string) => void): SpawnProcess;
    then(onFulfilled?: () => void): Promise<void>;
    catch(onRejected?: (error: any) => void): Promise<void>;
  }

  interface CockpitFile {
    (path: string): File;
  }

  interface CockpitSpawn {
    (command: string[], options?: SpawnOptions): SpawnProcess;
  }

  interface CockpitTransport {
    wait(callback: () => void): void;
  }

  interface Cockpit {
    file: CockpitFile;
    spawn: CockpitSpawn;
    transport: CockpitTransport;
  }

  const cockpit: Cockpit;
  export default cockpit;
}

declare const cockpit: {
  file: (path: string) => {
    read(): Promise<string>;
    replace(content: string): Promise<void>;
    access(): Promise<void>;
    list(): Promise<string[]>;
  };
  spawn: (command: string[], options?: { err?: 'out' | 'message' | 'ignore' }) => {
    stream(callback: (data: string) => void): any;
    then(onFulfilled?: () => void): Promise<void>;
    catch(onRejected?: (error: any) => void): Promise<void>;
  };
  transport: {
    wait(callback: () => void): void;
  };
};

export {};

