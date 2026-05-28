interface ImportMetaEnv {
  readonly WXT_SUPABASE_URL?: string;
  readonly WXT_SUPABASE_ANON_KEY?: string;
  readonly WXT_BACKEND_URL?: string;
  readonly WXT_GOOGLE_CLIENT_ID?: string;
}

declare namespace chrome.readingList {
  type ReadingListEntry = {
    creationTime: number;
    hasBeenRead: boolean;
    lastUpdateTime: number;
    title: string;
    url: string;
  };

  type QueryInfo = {
    hasBeenRead?: boolean;
    title?: string;
    url?: string;
  };

  type RemoveOptions = {
    url: string;
  };

  function query(info: QueryInfo): Promise<ReadingListEntry[]>;
  function removeEntry(info: RemoveOptions): Promise<void>;
}
