export const IPC = {
  KEYS_SAVE: 'keys:save',
  KEYS_CLEAR: 'keys:clear',
  KEYS_GET_STATUS: 'keys:get-status',
  MODELS_LIST_CATALOG: 'models:list-catalog',
  CHATS_LIST: 'chats:list',
  CHATS_GET: 'chats:get',
  CHATS_DELETE: 'chats:delete',
  SYSTEM_SHOW_IN_FOLDER: 'system:show-in-folder',
  GENERATION_SUBMIT: 'generation:submit',
  GENERATION_CANCEL: 'generation:cancel',
  GENERATION_PROGRESS: 'generation:progress',
  GENERATION_PREVIEW_READY: 'generation:preview-ready',
  GENERATION_COMPLETE: 'generation:complete',
  GENERATION_ERROR: 'generation:error'
} as const
