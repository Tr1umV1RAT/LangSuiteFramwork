import {
  MessageSquare,
  Database,
  GitBranch,
  Scissors,
  HardDrive,
  Boxes,
  Wrench,
  Bot,
  Terminal,
  Search,
  Plug,
  FileCode,
  Send,
  TableProperties,
  Layers,
  HandMetal,
  SaveAll,
  ArrowRightLeft,
  UserCheck,
  Bug,
  FileText,
  Dices,
  Globe,
  MousePointerClick,
  FileSearch,
  Link,
  ScanSearch,
  MapPin,
  TextCursorInput,
  Timer,
  ArrowDownUp,
  Keyboard,
  Camera,
  BookOpen,
  PenLine,
  Replace,
  FileUp,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react';
import { SELECTABLE_PROVIDER_OPTIONS } from './providerContracts';

export type Modality = 'text' | 'json' | 'image' | 'tool_call' | 'sound' | 'any';

export const MODALITY_COLORS: Record<Modality, string> = {
  text: '#3b82f6',
  json: '#10b981',
  image: '#a855f7',
  tool_call: '#f97316',
  sound: '#ec4899',
  any: '#6b7280',
};

export interface HandleDef {
  id: string;
  label: string;
  type: 'source' | 'target';
  position: 'left' | 'right';
  color: string;
  modality: Modality;
}

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'slider' | 'dynamic-routes' | 'string-list' | 'key_value_list';
  options?: { label: string; value: string }[];
  placeholder?: string;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}

export interface NodeTypeDef {
  type: string;
  label: string;
  icon: LucideIcon;
  category: 'IO' | 'LLM' | 'Data' | 'Logic' | 'Memory' | 'Tools' | 'Flow' | 'Playwright' | 'PlaywrightLG';
  color: string;
  gradient: string;
  handles: HandleDef[];
  fields: FieldDef[];
  advancedFields?: FieldDef[];
  defaultParams: Record<string, unknown>;
  isTool?: boolean;
  needsValidation?: boolean;
}

export const HANDLE_COLORS = MODALITY_COLORS;

export const CATEGORIES = [
  { id: 'IO', label: 'IN / OUT', icon: ArrowRightLeft },
  { id: 'LLM', label: 'Modèles LLM', icon: MessageSquare },
  { id: 'Data', label: 'Données', icon: Database },
  { id: 'Logic', label: 'Logique', icon: GitBranch },
  { id: 'Flow', label: 'Contrôle de Flux', icon: Layers },
  { id: 'Memory', label: 'Mémoire', icon: HardDrive },
  { id: 'Tools', label: 'Outils', icon: Wrench },
  { id: 'Playwright', label: 'Playwright', icon: Globe },
  { id: 'PlaywrightLG', label: 'Playwright LangGraph', icon: Globe },
] as const;

export const NODE_DEFS: Record<string, NodeTypeDef> = {
  user_input_node: {
    type: 'user_input_node',
    label: 'User Input',
    icon: UserCheck,
    category: 'IO',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    needsValidation: true,
    handles: [
      { id: 'data_out', label: 'Output', type: 'source', position: 'right', color: MODALITY_COLORS.text, modality: 'text' },
    ],
    fields: [
      { key: 'prompt', label: 'Prompt affiché', type: 'text', placeholder: 'Saisissez une valeur :', defaultValue: 'Saisissez une valeur :' },
      { key: 'output_key', label: 'Clé de sortie', type: 'text', placeholder: 'user_response', defaultValue: 'user_response' },
    ],
    defaultParams: {
      prompt: 'Saisissez une valeur :',
      output_key: 'user_response',
    },
  },

  debug_print: {
    type: 'debug_print',
    label: 'Debug Print',
    icon: Bug,
    category: 'IO',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    handles: [
      { id: 'data_in', label: 'Input', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'data_out', label: 'Output', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'input_key', label: 'Clé à inspecter', type: 'text', placeholder: 'messages', defaultValue: 'messages' },
    ],
    defaultParams: {
      input_key: 'messages',
    },
  },

  static_text: {
    type: 'static_text',
    label: 'Static Text',
    icon: FileText,
    category: 'IO',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    handles: [
      { id: 'data_out', label: 'Output', type: 'source', position: 'right', color: MODALITY_COLORS.text, modality: 'text' },
    ],
    fields: [
      { key: 'text', label: 'Texte statique', type: 'textarea', placeholder: 'Contenu statique à injecter dans le state...' },
      { key: 'output_key', label: 'Clé de sortie', type: 'text', placeholder: 'static_doc', defaultValue: 'static_doc' },
    ],
    defaultParams: {
      text: '',
      output_key: 'static_doc',
    },
  },

  python_executor_node: {
    type: 'python_executor_node',
    label: 'Python Executor',
    icon: FileCode,
    category: 'Logic',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
    handles: [
      { id: 'data_in', label: 'In', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'data_out', label: 'Out', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'code', label: 'Code Python', type: 'textarea', defaultValue: 'result = {"custom_vars": {"my_key": "val"}}' },
    ],
    defaultParams: {
      code: 'result = {"custom_vars": {"my_key": "val"}}',
    },
  },

  data_container: {
    type: 'data_container',
    label: 'Conteneur de Variables',
    icon: Database,
    category: 'Logic',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    isTool: false,
    handles: [
      { id: 'data_in', label: 'In', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'data_out', label: 'Out', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'variables', label: 'Variables (Clé / Valeur)', type: 'key_value_list', defaultValue: [] },
    ],
    defaultParams: { variables: [] },
  },

  runtime_context_read: {
    type: 'runtime_context_read',
    label: 'Runtime Context',
    icon: MapPin,
    category: 'Data',
    color: '#0f766e',
    gradient: 'linear-gradient(135deg, #0f766e, #115e59)',
    handles: [
      { id: 'data_out', label: 'Out', type: 'source', position: 'right', color: MODALITY_COLORS.json, modality: 'json' },
    ],
    fields: [
      { key: 'context_key', label: 'Clé de contexte', type: 'text', placeholder: 'user_id (vide = tout le contexte)', defaultValue: '' },
      { key: 'output_key', label: 'Clé de sortie', type: 'text', placeholder: 'runtime_context', defaultValue: 'runtime_context' },
      { key: 'default_value', label: 'Valeur par défaut', type: 'text', placeholder: 'none', defaultValue: '' },
    ],
    defaultParams: {
      context_key: '',
      output_key: 'runtime_context',
      default_value: '',
    },
  },

  chat_output: {
    type: 'chat_output',
    label: 'Chat Output',
    icon: MessageSquare,
    category: 'IO',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    handles: [
      { id: 'data_in', label: 'In', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'input_key', label: 'Clé du State (ex: messages)', type: 'text', defaultValue: 'messages' },
    ],
    defaultParams: {
      input_key: 'messages',
    },
  },

  llm_chat: {
    type: 'llm_chat',
    label: 'LLM Chat',
    icon: MessageSquare,
    category: 'LLM',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    handles: [
      { id: 'messages_in', label: 'Messages', type: 'target', position: 'left', color: MODALITY_COLORS.text, modality: 'text' },
      { id: 'documents_in', label: 'Documents', type: 'target', position: 'left', color: MODALITY_COLORS.json, modality: 'json' },
      { id: 'memory_in', label: 'Mémoire', type: 'target', position: 'left', color: MODALITY_COLORS.json, modality: 'json' },
      { id: 'messages_out', label: 'Messages', type: 'source', position: 'right', color: MODALITY_COLORS.text, modality: 'text' },
      { id: 'tools_in', label: 'Tools', type: 'target', position: 'right', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      {
        key: 'provider',
        label: 'Provider',
        type: 'select',
        options: SELECTABLE_PROVIDER_OPTIONS,
        defaultValue: 'openai',
      },
      { key: 'model_name', label: 'Modèle', type: 'text', placeholder: 'gpt-4o', defaultValue: 'gpt-4o' },
      { key: 'api_key_env', label: 'Clé API (variable env)', type: 'text', placeholder: 'OPENAI_API_KEY' },
      { key: 'temperature', label: 'Température', type: 'slider', min: 0, max: 2, step: 0.1, defaultValue: 0.7 },
      { key: 'system_prompt', label: 'System Prompt', type: 'textarea', placeholder: 'Tu es un assistant utile...' },
      { key: 'tools_linked', label: 'Outils liés', type: 'string-list', placeholder: 'nom de l\'outil' },
    ],
    advancedFields: [
      { key: 'max_tokens', label: 'Max Tokens', type: 'number', min: 1, max: 128000, step: 1, defaultValue: 4096 },
      { key: 'top_p', label: 'Top P', type: 'slider', min: 0, max: 1, step: 0.05, defaultValue: 1 },
      { key: 'frequency_penalty', label: 'Frequency Penalty', type: 'slider', min: -2, max: 2, step: 0.1, defaultValue: 0 },
      { key: 'presence_penalty', label: 'Presence Penalty', type: 'slider', min: -2, max: 2, step: 0.1, defaultValue: 0 },
      { key: 'api_base_url', label: 'API Base URL', type: 'text', placeholder: 'https://api.openai.com/v1' },
      { key: 'stop_sequences', label: 'Stop Sequences', type: 'string-list', placeholder: 'séquence' },
      { key: 'retries', label: 'Auto-Retry (réseau)', type: 'number', min: 0, max: 5, step: 1, defaultValue: 0 },
      { key: 'catch_errors', label: 'Catch Errors → State', type: 'select', options: [{ label: 'Non', value: '' }, { label: 'Oui', value: 'true' }], defaultValue: '' },
      { key: 'structured_schema_json', label: 'Schema JSON (Structured Output)', type: 'textarea', placeholder: '[{"name": "score", "type": "int", "description": "1 to 10"}]' },
      { key: 'structured_output_key', label: 'Structured Output Key', type: 'text', placeholder: 'custom_vars.analysis_data', defaultValue: '' },
      { key: 'execution_group', label: "Groupe d'exécution", type: 'text', placeholder: 'main', defaultValue: 'main' },
    ],
    defaultParams: {
      provider: 'openai',
      model_name: 'gpt-4o',
      api_key_env: '',
      temperature: 0.7,
      system_prompt: '',
      tools_linked: [],
      max_tokens: 4096,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      api_base_url: '',
      stop_sequences: [],
      retries: 0,
      catch_errors: '',
      structured_schema_json: '',
      structured_output_key: '',
      execution_group: 'main',
    },
  },

  react_agent: {
    type: 'react_agent',
    label: 'ReAct Agent',
    icon: Bot,
    category: 'LLM',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    handles: [
      { id: 'messages_in', label: 'Messages', type: 'target', position: 'left', color: MODALITY_COLORS.text, modality: 'text' },
      { id: 'documents_in', label: 'Documents', type: 'target', position: 'left', color: MODALITY_COLORS.json, modality: 'json' },
      { id: 'memory_in', label: 'Mémoire', type: 'target', position: 'left', color: MODALITY_COLORS.json, modality: 'json' },
      { id: 'messages_out', label: 'Messages', type: 'source', position: 'right', color: MODALITY_COLORS.text, modality: 'text' },
      { id: 'tools_in', label: 'Tools', type: 'target', position: 'right', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      {
        key: 'provider',
        label: 'Provider',
        type: 'select',
        options: SELECTABLE_PROVIDER_OPTIONS,
        defaultValue: 'openai',
      },
      { key: 'model_name', label: 'Modèle', type: 'text', placeholder: 'gpt-4o', defaultValue: 'gpt-4o' },
      { key: 'api_key_env', label: 'Clé API (variable env)', type: 'text', placeholder: 'OPENAI_API_KEY' },
      { key: 'temperature', label: 'Température', type: 'slider', min: 0, max: 2, step: 0.1, defaultValue: 0 },
      { key: 'system_prompt', label: 'Instructions Système', type: 'textarea', placeholder: 'Tu es un agent autonome capable d\'utiliser des outils...' },
      { key: 'tools_linked', label: 'Outils liés', type: 'string-list', placeholder: 'nom de l\'outil' },
    ],
    advancedFields: [
      { key: 'max_tokens', label: 'Max Tokens', type: 'number', min: 1, max: 128000, step: 1, defaultValue: 4096 },
      { key: 'top_p', label: 'Top P', type: 'slider', min: 0, max: 1, step: 0.05, defaultValue: 1 },
      { key: 'frequency_penalty', label: 'Frequency Penalty', type: 'slider', min: -2, max: 2, step: 0.1, defaultValue: 0 },
      { key: 'presence_penalty', label: 'Presence Penalty', type: 'slider', min: -2, max: 2, step: 0.1, defaultValue: 0 },
      { key: 'api_base_url', label: 'API Base URL', type: 'text', placeholder: 'http://127.0.0.1:1234/v1', defaultValue: '' },
      { key: 'stop_sequences', label: 'Stop Sequences', type: 'string-list', placeholder: 'séquence' },
      { key: 'max_iterations', label: 'Max Itérations', type: 'number', min: 1, max: 50, step: 1, defaultValue: 10 },
      { key: 'retries', label: 'Auto-Retry (réseau)', type: 'number', min: 0, max: 5, step: 1, defaultValue: 0 },
      { key: 'catch_errors', label: 'Catch Errors → State', type: 'select', options: [{ label: 'Non', value: '' }, { label: 'Oui', value: 'true' }], defaultValue: '' },
      { key: 'structured_schema_json', label: 'Schema JSON (Structured Output)', type: 'textarea', placeholder: '[{"name": "score", "type": "int", "description": "1 to 10"}]' },
      { key: 'structured_output_key', label: 'Structured Output Key', type: 'text', placeholder: 'custom_vars.analysis_data', defaultValue: '' },
      { key: 'execution_group', label: "Groupe d'exécution", type: 'text', placeholder: 'main', defaultValue: 'main' },
    ],
    defaultParams: {
      provider: 'openai',
      model_name: 'gpt-4o',
      api_key_env: '',
      temperature: 0,
      system_prompt: '',
      tools_linked: [],
      max_tokens: 4096,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      api_base_url: '',
      stop_sequences: [],
      max_iterations: 10,
      retries: 0,
      catch_errors: '',
      structured_schema_json: '',
      structured_output_key: '',
      execution_group: 'main',
    },
  },


  subgraph_node: {
    type: 'subgraph_node',
    label: 'Subgraph',
    icon: GitBranch,
    category: 'Flow',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    handles: [
      { id: 'messages_in', label: 'Messages', type: 'target', position: 'left', color: MODALITY_COLORS.text, modality: 'text' },
      { id: 'documents_in', label: 'Documents', type: 'target', position: 'left', color: MODALITY_COLORS.json, modality: 'json' },
      { id: 'memory_in', label: 'Mémoire', type: 'target', position: 'left', color: MODALITY_COLORS.json, modality: 'json' },
      { id: 'messages_out', label: 'Messages', type: 'source', position: 'right', color: MODALITY_COLORS.text, modality: 'text' },
    ],
    fields: [
      { key: 'target_subgraph', label: 'Nom du subgraph', type: 'text', placeholder: 'research_subgraph', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Sous-graphe enfant ou référence de subgraph sauvegardé...' },
    ],
    defaultParams: {
      target_subgraph: '',
      description: '',
    },
  },

  sub_agent: {
    type: 'sub_agent',
    label: 'Agent Artifact',
    icon: Boxes,
    category: 'LLM',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899, #db2777)',
    handles: [
      { id: 'messages_in', label: 'Messages', type: 'target', position: 'left', color: MODALITY_COLORS.text, modality: 'text' },
      { id: 'documents_in', label: 'Documents', type: 'target', position: 'left', color: MODALITY_COLORS.json, modality: 'json' },
      { id: 'memory_in', label: 'Mémoire', type: 'target', position: 'left', color: MODALITY_COLORS.json, modality: 'json' },
      { id: 'messages_out', label: 'Messages', type: 'source', position: 'right', color: MODALITY_COLORS.text, modality: 'text' },
      { id: 'tools_in', label: 'Tools', type: 'target', position: 'right', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'target_subgraph', label: 'Artefact agent', type: 'text', placeholder: 'artifact:agent/research_agent', required: true },
      { key: 'system_prompt', label: 'Notes wrapper', type: 'textarea', placeholder: 'Notes de wrapper / d\'intégration pour cet artefact agent...' },
      { key: 'tools_linked', label: 'Outils liés', type: 'string-list', placeholder: 'nom de l\'outil' },
    ],
    advancedFields: [
      {
        key: 'provider',
        label: 'Provider',
        type: 'select',
        options: [
          { label: 'Hérite du parent', value: '' },
          { label: 'OpenAI', value: 'openai' },
          { label: 'OpenAI-compatible', value: 'openai_compat' },
          { label: 'LM Studio', value: 'lm_studio' },
          { label: 'llama.cpp server', value: 'llama_cpp' },
          { label: 'Anthropic', value: 'anthropic' },
          { label: 'Ollama', value: 'ollama' },
          { label: 'Ollama', value: 'ollama' },
          { label: 'Mistral', value: 'mistralai' },
        ],
        defaultValue: '',
      },
      { key: 'model_name', label: 'Modèle', type: 'text', placeholder: 'gpt-4o' },
      { key: 'api_key_env', label: 'Clé API (variable env)', type: 'text', placeholder: 'OPENAI_API_KEY' },
      { key: 'temperature', label: 'Température', type: 'slider', min: 0, max: 2, step: 0.1, defaultValue: 0.7 },
      { key: 'max_iterations', label: 'Max Itérations', type: 'number', min: 1, max: 50, step: 1, defaultValue: 10 },
      { key: 'retries', label: 'Auto-Retry (réseau)', type: 'number', min: 0, max: 5, step: 1, defaultValue: 0 },
      { key: 'catch_errors', label: 'Catch Errors → State', type: 'select', options: [{ label: 'Non', value: '' }, { label: 'Oui', value: 'true' }], defaultValue: '' },
    ],
    defaultParams: {
      target_subgraph: '',
      system_prompt: '',
      tools_linked: [],
      provider: '',
      model_name: '',
      api_key_env: '',
      temperature: 0.7,
      max_iterations: 10,
      retries: 0,
      catch_errors: '',
    },
  },

  tool_executor: {
    type: 'tool_executor',
    label: 'Tool Executor',
    icon: Wrench,
    category: 'Logic',
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
    handles: [
      { id: 'messages_in', label: 'Tool Calls', type: 'target', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
      { id: 'messages_out', label: 'Résultats', type: 'source', position: 'right', color: MODALITY_COLORS.text, modality: 'text' },
    ],
    fields: [],
    defaultParams: {},
  },

  rag_retriever_local: {
    type: 'rag_retriever_local',
    label: 'RAG Local',
    icon: Database,
    category: 'Data',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    handles: [
      { id: 'messages_in', label: 'Query', type: 'target', position: 'left', color: MODALITY_COLORS.text, modality: 'text' },
      { id: 'documents_out', label: 'Documents', type: 'source', position: 'right', color: MODALITY_COLORS.json, modality: 'json' },
    ],
    fields: [
      { key: 'db_path', label: 'DB Path', type: 'text', placeholder: './local_chroma_db', defaultValue: './local_chroma_db' },
      { key: 'collection_name', label: 'Collection', type: 'text', placeholder: 'knowledge_base', defaultValue: 'knowledge_base' },
      { key: 'top_k', label: 'Top-K', type: 'number', min: 1, max: 20, step: 1, defaultValue: 4 },
    ],
    advancedFields: [
      { key: 'embedding_model', label: 'Modèle Embedding', type: 'text', placeholder: 'sentence-transformers/all-MiniLM-L6-v2' },
      { key: 'score_threshold', label: 'Score Minimum', type: 'slider', min: 0, max: 1, step: 0.05, defaultValue: 0 },
      { key: 'chunk_overlap', label: 'Chunk Overlap', type: 'number', min: 0, max: 500, step: 10, defaultValue: 50 },
      { key: 'retries', label: 'Auto-Retry', type: 'number', min: 0, max: 5, step: 1, defaultValue: 0 },
      { key: 'catch_errors', label: 'Catch Errors → State', type: 'select', options: [{ label: 'Non', value: '' }, { label: 'Oui', value: 'true' }], defaultValue: '' },
    ],
    defaultParams: {
      db_path: './local_chroma_db',
      collection_name: 'knowledge_base',
      top_k: 4,
      embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
      score_threshold: 0,
      chunk_overlap: 50,
      retries: 0,
      catch_errors: '',
    },
  },

  logic_router: {
    type: 'logic_router',
    label: 'Router',
    icon: GitBranch,
    category: 'Logic',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'state_key', label: 'State Key', type: 'text', placeholder: 'messages', defaultValue: 'messages' },
      { key: 'json_field', label: 'Champ JSON', type: 'text', placeholder: 'route', defaultValue: 'route' },
      { key: 'routes', label: 'Routes', type: 'dynamic-routes' },
      { key: 'fallback_handle', label: 'Fallback Handle', type: 'text', placeholder: 'fallback', defaultValue: 'fallback' },
    ],
    defaultParams: {
      state_key: 'messages',
      json_field: 'route',
      routes: [{ value: 'continue', handle_id: 'continue' }],
      fallback_handle: 'fallback',
    },
  },

  structured_output_extract: {
    type: 'structured_output_extract',
    label: 'Structured Extract',
    icon: TableProperties,
    category: 'Logic',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
    handles: [
      { id: 'data_in', label: 'In', type: 'target', position: 'left', color: MODALITY_COLORS.json, modality: 'json' },
      { id: 'data_out', label: 'Out', type: 'source', position: 'right', color: MODALITY_COLORS.json, modality: 'json' },
    ],
    fields: [
      { key: 'source_key', label: 'Clé source', type: 'text', placeholder: 'analysis_struct', defaultValue: 'analysis_struct' },
      { key: 'field_name', label: 'Champ à extraire', type: 'text', placeholder: 'score (vide = payload complet)', defaultValue: '' },
      { key: 'output_key', label: 'Clé de sortie', type: 'text', placeholder: 'structured_value', defaultValue: 'structured_value' },
      { key: 'default_value', label: 'Valeur par défaut', type: 'text', placeholder: '', defaultValue: '' },
    ],
    defaultParams: {
      source_key: 'analysis_struct',
      field_name: '',
      output_key: 'structured_value',
      default_value: '',
    },
  },

  structured_output_router: {
    type: 'structured_output_router',
    label: 'Structured Router',
    icon: Replace,
    category: 'Logic',
    color: '#7c3aed',
    gradient: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
    handles: [
      { id: 'data_in', label: 'In', type: 'target', position: 'left', color: MODALITY_COLORS.json, modality: 'json' },
      { id: 'continue', label: 'Route', type: 'source', position: 'right', color: MODALITY_COLORS.json, modality: 'json' },
    ],
    fields: [
      { key: 'source_key', label: 'Clé source', type: 'text', placeholder: 'analysis_struct', defaultValue: 'analysis_struct' },
      { key: 'field_name', label: 'Champ de décision', type: 'text', placeholder: 'status', defaultValue: 'status' },
      { key: 'routes', label: 'Routes', type: 'dynamic-routes', defaultValue: {} },
      { key: 'fallback_handle', label: 'Route fallback', type: 'text', placeholder: 'fallback', defaultValue: 'fallback' },
    ],
    defaultParams: {
      source_key: 'analysis_struct',
      field_name: 'status',
      routes: {},
      fallback_handle: 'fallback',
    },
  },

  context_trimmer: {
    type: 'context_trimmer',
    label: 'Trimmer',
    icon: Scissors,
    category: 'Logic',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    handles: [
      { id: 'messages_in', label: 'Messages', type: 'target', position: 'left', color: MODALITY_COLORS.text, modality: 'text' },
      { id: 'messages_out', label: 'Messages', type: 'source', position: 'right', color: MODALITY_COLORS.text, modality: 'text' },
    ],
    fields: [
      { key: 'max_messages', label: 'Max Messages', type: 'number', min: 1, max: 100, step: 1, defaultValue: 10 },
    ],
    advancedFields: [
      { key: 'strategy', label: 'Stratégie', type: 'select', options: [{ label: 'Derniers messages', value: 'last' }, { label: 'Résumé', value: 'summary' }], defaultValue: 'last' },
      { key: 'keep_system', label: 'Garder System', type: 'select', options: [{ label: 'Oui', value: 'true' }, { label: 'Non', value: 'false' }], defaultValue: 'true' },
    ],
    defaultParams: {
      max_messages: 10,
      strategy: 'last',
      keep_system: 'true',
    },
  },

  /* memory_store_read masqué — remplacé par memoryreader (plus simple)
  memory_store_read: {
    type: 'memory_store_read',
    label: 'Memory Read',
    icon: HardDrive,
    category: 'Memory',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'data_out', label: 'Data', type: 'source', position: 'right', color: MODALITY_COLORS.json, modality: 'json' },
    ],
    fields: [
      { key: 'namespace_prefix', label: 'Namespace', type: 'text', placeholder: 'user_profiles', required: true },
      { key: 'user_id_key', label: 'User ID Key', type: 'text', placeholder: 'custom_vars.user_id', required: true },
      { key: 'output_key', label: 'Output Key', type: 'text', placeholder: 'custom_vars.profile', required: true },
    ],
    advancedFields: [
      { key: 'ttl_seconds', label: 'TTL (secondes)', type: 'number', min: 0, max: 86400, step: 60, defaultValue: 0 },
      { key: 'max_entries', label: 'Max Entrées', type: 'number', min: 1, max: 1000, step: 1, defaultValue: 100 },
    ],
    defaultParams: {
      namespace_prefix: '',
      user_id_key: '',
      output_key: '',
      ttl_seconds: 0,
      max_entries: 100,
    },
  },
  */

  parallel_aggregator: {
    type: 'parallel_aggregator',
    label: 'Parallel Aggregator',
    icon: Layers,
    category: 'Flow',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
    handles: [
      { id: 'data_in_1', label: 'Input 1', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'data_in_2', label: 'Input 2', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'data_in_3', label: 'Input 3', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'data_out', label: 'Résultat', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'input_keys', label: 'Clés d\'entrée (state)', type: 'string-list', placeholder: 'ex: research_data' },
      { key: 'output_key', label: 'Clé de sortie', type: 'text', placeholder: 'final_context', defaultValue: 'final_context' },
    ],
    defaultParams: {
      input_keys: [],
      output_key: 'final_context',
    },
  },

  human_interrupt: {
    type: 'human_interrupt',
    label: 'Human Interrupt',
    icon: HandMetal,
    category: 'Flow',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    needsValidation: true,
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'state_out', label: 'State', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'description', label: 'Raison de l\'interruption', type: 'textarea', placeholder: 'Validation humaine requise avant de continuer...' },
    ],
    defaultParams: {
      description: '',
    },
  },


  command_node: {
    type: 'command_node',
    label: 'Command Node',
    icon: ArrowDownUp,
    category: 'Flow',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'state_out', label: 'State', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'target_key', label: 'Clé custom_vars', type: 'text', placeholder: 'route_state', defaultValue: 'route_state' },
      { key: 'new_value', label: 'Nouvelle valeur', type: 'text', placeholder: 'approved', defaultValue: 'approved' },
    ],
    advancedFields: [
      { key: 'command_message', label: 'Message optionnel', type: 'textarea', placeholder: 'Message de trace ou de debug affiché au passage de commande.' },
    ],
    defaultParams: {
      target_key: 'route_state',
      new_value: 'approved',
      command_message: '',
    },
  },

  handoff_node: {
    type: 'handoff_node',
    label: 'Handoff',
    icon: Send,
    category: 'Flow',
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7, #9333ea)',
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'state_out', label: 'State', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'handoff_key', label: 'Clé handoff', type: 'text', placeholder: 'active_agent', defaultValue: 'active_agent' },
      { key: 'handoff_value', label: 'Valeur handoff', type: 'text', placeholder: 'research_agent', defaultValue: 'research_agent' },
    ],
    advancedFields: [
      { key: 'handoff_message', label: 'Message optionnel', type: 'textarea', placeholder: 'Passage vers research_agent' },
    ],
    defaultParams: {
      handoff_key: 'active_agent',
      handoff_value: 'research_agent',
      handoff_message: '',
    },
  },



  send_fanout: {
    type: 'send_fanout',
    label: 'Send Fanout',
    icon: Send,
    category: 'Flow',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'state_out', label: 'Dispatch', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'items_key', label: 'Clé liste source', type: 'text', placeholder: 'documents', defaultValue: 'documents' },
      { key: 'item_state_key', label: 'Clé item worker', type: 'text', placeholder: 'current_item', defaultValue: 'current_item' },
    ],
    advancedFields: [
      { key: 'passthrough_state_keys', label: 'Clés state à propager', type: 'string-list', placeholder: 'topic,request_id' },
      { key: 'copy_messages', label: 'Copier messages', type: 'select', options: [{ label: 'Non', value: 'false' }, { label: 'Oui', value: 'true' }], defaultValue: 'false' },
      { key: 'copy_custom_vars', label: 'Copier custom_vars', type: 'select', options: [{ label: 'Oui', value: 'true' }, { label: 'Non', value: 'false' }], defaultValue: 'true' },
      { key: 'fanout_count_key', label: 'Clé count (optionnel)', type: 'text', placeholder: 'fanout_count', defaultValue: '' },
    ],
    defaultParams: {
      items_key: 'documents',
      item_state_key: 'current_item',
      passthrough_state_keys: [],
      copy_messages: 'false',
      copy_custom_vars: 'true',
      fanout_count_key: '',
    },
  },


  reduce_join: {
    type: 'reduce_join',
    label: 'Reduce Join',
    icon: Layers,
    category: 'Flow',
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, #14b8a6, #0f766e)',
    handles: [
      { id: 'state_in', label: 'Worker State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'state_out', label: 'Reduced', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'results_key', label: 'Clé résultats', type: 'text', placeholder: 'fanout_results', defaultValue: 'fanout_results' },
      { key: 'output_key', label: 'Clé sortie', type: 'text', placeholder: 'fanout_joined', defaultValue: 'fanout_joined' },
    ],
    advancedFields: [
      { key: 'join_mode', label: 'Mode reduce', type: 'select', options: [
        { label: 'Liste brute', value: 'list' },
        { label: 'Texte joint', value: 'text_join' },
        { label: 'Premier non nul', value: 'first_non_null' },
        { label: 'Count', value: 'count' },
      ], defaultValue: 'list' },
      { key: 'item_field', label: 'Champ item (optionnel)', type: 'text', placeholder: 'summary', defaultValue: '' },
      { key: 'separator', label: 'Séparateur texte', type: 'text', placeholder: '\n\n', defaultValue: '\n\n' },
      { key: 'progress_key', label: 'Clé progression (optionnel)', type: 'text', placeholder: 'fanout_progress', defaultValue: '' },
    ],
    defaultParams: {
      results_key: 'fanout_results',
      output_key: 'fanout_joined',
      join_mode: 'list',
      item_field: '',
      separator: '\n\n',
      progress_key: '',
    },
  },

  memory_checkpoint: {
    type: 'memory_checkpoint',
    label: 'Checkpoint',
    icon: SaveAll,
    category: 'Memory',
    color: '#22d3ee',
    gradient: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
    handles: [],
    fields: [
      { key: 'description', label: 'Note', type: 'textarea', placeholder: 'Active la persistance MemorySaver pour ce graphe.' },
    ],
    defaultParams: {
      description: 'Active la persistance via MemorySaver.',
    },
  },

  memoryreader: {
    type: 'memoryreader',
    label: 'Memory Read Helper',
    icon: BookOpen,
    category: 'Memory',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'memory_out', label: 'Memory', type: 'source', position: 'right', color: MODALITY_COLORS.json, modality: 'json' },
    ],
    fields: [
      { key: 'memory_key', label: 'Clé Mémoire', type: 'text', placeholder: 'profile', defaultValue: 'profile' },
      { key: 'output_key', label: 'Clé de sortie', type: 'text', placeholder: 'memory_data', defaultValue: 'memory_data' },
    ],
    defaultParams: {
      memory_key: 'profile',
      output_key: 'memory_data',
    },
  },



  memory_access: {
    type: 'memory_access',
    label: 'Memory Access',
    icon: BookOpen,
    category: 'Memory',
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'memory_out', label: 'Memory', type: 'source', position: 'right', color: MODALITY_COLORS.json, modality: 'json' },
    ],
    fields: [
      { key: 'access_mode', label: 'Mode accès', type: 'select', options: [
        { label: 'Profile Read', value: 'profile_read' },
        { label: 'Store Get', value: 'get' },
        { label: 'Store Search', value: 'search' },
      ], defaultValue: 'profile_read' },
      { key: 'namespace_prefix', label: 'Namespace', type: 'text', placeholder: 'memory', defaultValue: 'memory' },
      { key: 'output_key', label: 'Clé sortie', type: 'text', placeholder: 'memory_payload', defaultValue: 'memory_payload' },
    ],
    advancedFields: [
      { key: 'user_id_key', label: 'User ID Key (profile)', type: 'text', placeholder: 'custom_vars.user_id', defaultValue: 'custom_vars.user_id' },
      { key: 'store_item_key', label: 'Store Key (get/profile)', type: 'text', placeholder: 'profile', defaultValue: 'profile' },
      { key: 'query_key', label: 'Clé requête (search)', type: 'text', placeholder: 'messages', defaultValue: 'messages' },
      { key: 'limit', label: 'Limite search', type: 'number', min: 1, max: 50, step: 1, defaultValue: 5 },
    ],
    defaultParams: {
      access_mode: 'profile_read',
      namespace_prefix: 'memory',
      output_key: 'memory_payload',
      user_id_key: 'custom_vars.user_id',
      store_item_key: 'profile',
      query_key: 'messages',
      limit: 5,
    },
  },

  memorywriter: {
    type: 'memorywriter',
    label: 'Memory Write Helper',
    icon: PenLine,
    category: 'Memory',
    color: '#0891b2',
    gradient: 'linear-gradient(135deg, #0891b2, #0e7490)',
    handles: [
      { id: 'data_in', label: 'Données', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'state_key_to_save', label: 'Clé State à sauvegarder', type: 'text', placeholder: 'messages', defaultValue: 'messages' },
      { key: 'memory_key', label: 'Clé Mémoire', type: 'text', placeholder: 'profile', defaultValue: 'profile' },
    ],
    defaultParams: {
      state_key_to_save: 'messages',
      memory_key: 'profile',
    },
  },


  store_put: {
    type: 'store_put',
    label: 'Store Put',
    icon: SaveAll,
    category: 'Memory',
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, #14b8a6, #0f766e)',
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'state_out', label: 'State', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'namespace_prefix', label: 'Namespace', type: 'text', placeholder: 'memory', defaultValue: 'memory' },
      { key: 'store_item_key', label: 'Store Key', type: 'text', placeholder: 'profile', defaultValue: 'profile' },
      { key: 'state_key_to_save', label: 'Clé State à sauvegarder', type: 'text', placeholder: 'messages', defaultValue: 'messages' },
    ],
    advancedFields: [
      { key: 'output_key', label: 'Clé reçu (optionnel)', type: 'text', placeholder: 'store_receipt', defaultValue: '' },
    ],
    defaultParams: {
      namespace_prefix: 'memory',
      store_item_key: 'profile',
      state_key_to_save: 'messages',
      output_key: '',
    },
  },

  store_search: {
    type: 'store_search',
    label: 'Store Search',
    icon: Search,
    category: 'Memory',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'data_out', label: 'Results', type: 'source', position: 'right', color: MODALITY_COLORS.json, modality: 'json' },
    ],
    fields: [
      { key: 'namespace_prefix', label: 'Namespace', type: 'text', placeholder: 'memory', defaultValue: 'memory' },
      { key: 'query_key', label: 'Clé requête', type: 'text', placeholder: 'messages', defaultValue: 'messages' },
      { key: 'output_key', label: 'Clé de sortie', type: 'text', placeholder: 'store_results', defaultValue: 'store_results' },
    ],
    advancedFields: [
      { key: 'limit', label: 'Limite', type: 'number', min: 1, max: 50, step: 1, defaultValue: 5 },
    ],
    defaultParams: {
      namespace_prefix: 'memory',
      query_key: 'messages',
      output_key: 'store_results',
      limit: 5,
    },
  },



  store_get: {
    type: 'store_get',
    label: 'Store Get',
    icon: Database,
    category: 'Memory',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'data_out', label: 'Value', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'namespace_prefix', label: 'Namespace', type: 'text', placeholder: 'memory', defaultValue: 'memory' },
      { key: 'store_item_key', label: 'Store Key', type: 'text', placeholder: 'profile', defaultValue: 'profile' },
      { key: 'output_key', label: 'Clé de sortie', type: 'text', placeholder: 'store_value', defaultValue: 'store_value' },
    ],
    defaultParams: {
      namespace_prefix: 'memory',
      store_item_key: 'profile',
      output_key: 'store_value',
    },
  },

  store_delete: {
    type: 'store_delete',
    label: 'Store Delete',
    icon: Scissors,
    category: 'Memory',
    color: '#ef4444',
    gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'state_out', label: 'State', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'namespace_prefix', label: 'Namespace', type: 'text', placeholder: 'memory', defaultValue: 'memory' },
      { key: 'store_item_key', label: 'Store Key', type: 'text', placeholder: 'profile', defaultValue: 'profile' },
    ],
    advancedFields: [
      { key: 'output_key', label: 'Clé reçu (optionnel)', type: 'text', placeholder: 'store_delete_receipt', defaultValue: '' },
    ],
    defaultParams: {
      namespace_prefix: 'memory',
      store_item_key: 'profile',
      output_key: '',
    },
  },

  update_state_node: {
    type: 'update_state_node',
    label: 'Update State',
    icon: Replace,
    category: 'Logic',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    handles: [
      { id: 'state_in', label: 'State', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'state_out', label: 'State', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'target_key', label: 'Clé cible', type: 'text', placeholder: 'status', defaultValue: 'status' },
      { key: 'new_value', label: 'Nouvelle valeur', type: 'text', placeholder: '""', defaultValue: '""' },
    ],
    defaultParams: {
      target_key: 'status',
      new_value: '""',
    },
  },

  file_loader_node: {
    type: 'file_loader_node',
    label: 'File Loader',
    icon: FileUp,
    category: 'Data',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    handles: [
      { id: 'data_out', label: 'Documents', type: 'source', position: 'right', color: MODALITY_COLORS.json, modality: 'json' },
    ],
    fields: [
      { key: 'file_path', label: 'Chemin du fichier', type: 'text', placeholder: 'document.pdf', required: true },
      { key: 'output_key', label: 'Clé de sortie', type: 'text', placeholder: 'documents', defaultValue: 'documents' },
    ],
    advancedFields: [
      { key: 'catch_errors', label: 'Catch Errors → State', type: 'select', options: [{ label: 'Non', value: '' }, { label: 'Oui', value: 'true' }], defaultValue: '' },
    ],
    defaultParams: {
      file_path: '',
      output_key: 'documents',
      catch_errors: '',
    },
  },

  tool_python_repl: {
    type: 'tool_python_repl',
    label: 'Python REPL',
    icon: Terminal,
    category: 'Tools',
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Exécute du code Python pour des calculs complexes...', defaultValue: 'Exécute du code Python pour faire des calculs complexes ou traiter des données.' },
    ],
    defaultParams: {
      description: 'Exécute du code Python pour faire des calculs complexes ou traiter des données.',
    },
  },

  tool_web_search: {
    type: 'tool_web_search',
    label: 'Tavily Search',
    icon: Search,
    category: 'Tools',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'tavily_api_key', label: 'Tavily API Key (env var)', type: 'text', placeholder: 'TAVILY_API_KEY', required: true, defaultValue: 'TAVILY_API_KEY' },
      { key: 'max_results', label: 'Max results', type: 'number', min: 1, max: 10, step: 1, defaultValue: 3 },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Tavily-backed web search...', defaultValue: 'Tavily-backed web search for current information.' },
    ],
    defaultParams: {
      tavily_api_key: 'TAVILY_API_KEY',
      max_results: 3,
      description: 'Tavily-backed web search for current information.',
    },
  },

  tool_brave_search: {
    type: 'tool_brave_search',
    label: 'Brave Search',
    icon: Globe,
    category: 'Tools',
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'brave_api_key', label: 'Brave API Key (env var)', type: 'text', placeholder: 'BRAVE_SEARCH_API_KEY', required: true, defaultValue: 'BRAVE_SEARCH_API_KEY' },
      { key: 'max_results', label: 'Max results', type: 'number', min: 1, max: 20, step: 1, defaultValue: 5 },
      { key: 'timeout_seconds', label: 'Timeout (s)', type: 'number', min: 1, max: 120, step: 1, defaultValue: 15 },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brave provider-backed web search...', defaultValue: 'Brave provider-backed web search for current public information.' },
    ],
    defaultParams: {
      brave_api_key: 'BRAVE_SEARCH_API_KEY',
      max_results: 5,
      timeout_seconds: 15,
      description: 'Brave provider-backed web search for current public information.',
    },
  },

  tool_duckduckgo_search: {
    type: 'tool_duckduckgo_search',
    label: 'DuckDuckGo Search',
    icon: Search,
    category: 'Tools',
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'max_results', label: 'Max results', type: 'number', min: 1, max: 20, step: 1, defaultValue: 5 },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'DuckDuckGo search...', defaultValue: 'DuckDuckGo search for current public web results.' },
    ],
    defaultParams: {
      max_results: 5,
      description: 'DuckDuckGo search for current public web results.',
    },
  },

  tool_tavily_extract: {
    type: 'tool_tavily_extract',
    label: 'Tavily Extract',
    icon: ScanSearch,
    category: 'Tools',
    color: '#0284c7',
    gradient: 'linear-gradient(135deg, #0284c7, #0369a1)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'tavily_api_key', label: 'Tavily API Key (env var)', type: 'text', placeholder: 'TAVILY_API_KEY', required: true, defaultValue: 'TAVILY_API_KEY' },
      { key: 'extract_depth', label: 'Extract depth', type: 'select', options: [{ label: 'Basic', value: 'basic' }, { label: 'Advanced', value: 'advanced' }], defaultValue: 'basic' },
      { key: 'include_images', label: 'Include images', type: 'select', options: [{ label: 'No', value: 'false' }, { label: 'Yes', value: 'true' }], defaultValue: 'false' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Extracts content from provided URLs...', defaultValue: 'Tavily-backed URL extraction for provided pages.' },
    ],
    defaultParams: {
      tavily_api_key: 'TAVILY_API_KEY',
      extract_depth: 'basic',
      include_images: 'false',
      description: 'Tavily-backed URL extraction for provided pages.',
    },
  },

  tool_rest_api: {
    type: 'tool_rest_api',
    label: 'REST API',
    icon: Plug,
    category: 'Tools',
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7, #9333ea)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/endpoint', required: true },
      {
        key: 'method',
        label: 'Méthode',
        type: 'select',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'DELETE', value: 'DELETE' },
        ],
        defaultValue: 'POST',
      },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Appel API REST...', defaultValue: 'Appel API REST généré dynamiquement' },
    ],
    advancedFields: [
      { key: 'headers_json', label: 'Headers (JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer ..."}' },
    ],
    defaultParams: {
      url: '',
      method: 'POST',
      description: 'Appel API REST généré dynamiquement',
      headers_json: '{}',
    },
  },

  tool_api_call: {
    type: 'tool_api_call',
    label: 'API Call (POST)',
    icon: Send,
    category: 'Tools',
    color: '#f43f5e',
    gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'url', label: 'URL Endpoint', type: 'text', placeholder: 'https://api.example.com/endpoint', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Effectue une requête HTTP POST...', defaultValue: 'Effectue une requête HTTP POST vers l\'endpoint configuré.' },
    ],
    advancedFields: [
      { key: 'headers_json', label: 'Headers (JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer ...", "Content-Type": "application/json"}' },
    ],
    defaultParams: {
      url: '',
      description: 'Effectue une requête HTTP POST vers l\'endpoint configuré.',
      headers_json: '{}',
    },
  },

  tool_requests_get: {
    type: 'tool_requests_get',
    label: 'Requests GET',
    icon: ArrowDownUp,
    category: 'Tools',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'base_url', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com', defaultValue: '', required: false },
      { key: 'allow_full_urls', label: 'Allow full URLs', type: 'select', options: [{ label: 'No', value: 'false' }, { label: 'Yes', value: 'true' }], defaultValue: 'false' },
      { key: 'timeout_seconds', label: 'Timeout (s)', type: 'number', min: 1, max: 120, step: 1, defaultValue: 15 },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Requests toolkit GET surface...', defaultValue: 'Requests toolkit GET surface for stateless HTTP reads.' },
    ],
    advancedFields: [
      { key: 'headers_json', label: 'Headers (JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer ..."}' },
    ],
    defaultParams: {
      base_url: '',
      allow_full_urls: 'false',
      timeout_seconds: 15,
      description: 'Requests toolkit GET surface for stateless HTTP reads.',
      headers_json: '{}',
    },
  },

  tool_requests_post: {
    type: 'tool_requests_post',
    label: 'Requests POST',
    icon: Send,
    category: 'Tools',
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7, #9333ea)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'base_url', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com', defaultValue: '', required: false },
      { key: 'allow_full_urls', label: 'Allow full URLs', type: 'select', options: [{ label: 'No', value: 'false' }, { label: 'Yes', value: 'true' }], defaultValue: 'false' },
      { key: 'timeout_seconds', label: 'Timeout (s)', type: 'number', min: 1, max: 120, step: 1, defaultValue: 15 },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Requests toolkit POST surface...', defaultValue: 'Requests toolkit POST surface for stateless HTTP writes or RPC-style calls.' },
    ],
    advancedFields: [
      { key: 'headers_json', label: 'Headers (JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer ...", "Content-Type": "application/json"}' },
    ],
    defaultParams: {
      base_url: '',
      allow_full_urls: 'false',
      timeout_seconds: 15,
      description: 'Requests toolkit POST surface for stateless HTTP writes or RPC-style calls.',
      headers_json: '{}',
    },
  },


  tool_fs_list_dir: {
    type: 'tool_fs_list_dir',
    label: 'FS List Directory',
    icon: HardDrive,
    category: 'Tools',
    color: '#16a34a',
    gradient: 'linear-gradient(135deg, #16a34a, #15803d)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'root_path', label: 'Root path', type: 'text', placeholder: '.', defaultValue: '.' },
      { key: 'include_hidden', label: 'Include hidden', type: 'select', options: [{ label: 'No', value: 'false' }, { label: 'Yes', value: 'true' }], defaultValue: 'false' },
      { key: 'max_results', label: 'Max entries', type: 'number', min: 1, max: 500, step: 1, defaultValue: 100 },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'List files and directories from a bounded local root...', defaultValue: 'Read-only local filesystem listing from a bounded root path.' },
    ],
    defaultParams: {
      root_path: '.',
      include_hidden: 'false',
      max_results: 100,
      description: 'Read-only local filesystem listing from a bounded root path.',
    },
  },

  tool_fs_read_file: {
    type: 'tool_fs_read_file',
    label: 'FS Read File',
    icon: FileText,
    category: 'Tools',
    color: '#15803d',
    gradient: 'linear-gradient(135deg, #15803d, #166534)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'root_path', label: 'Root path', type: 'text', placeholder: '.', defaultValue: '.' },
      { key: 'max_bytes', label: 'Max bytes preview', type: 'number', min: 256, max: 5000000, step: 256, defaultValue: 200000 },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Read one text file from a bounded local root...', defaultValue: 'Read one local text file from a bounded root path.' },
    ],
    defaultParams: {
      root_path: '.',
      max_bytes: 200000,
      description: 'Read one local text file from a bounded root path.',
    },
  },

  tool_fs_glob: {
    type: 'tool_fs_glob',
    label: 'FS Glob',
    icon: ScanSearch,
    category: 'Tools',
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'root_path', label: 'Root path', type: 'text', placeholder: '.', defaultValue: '.' },
      { key: 'include_hidden', label: 'Include hidden', type: 'select', options: [{ label: 'No', value: 'false' }, { label: 'Yes', value: 'true' }], defaultValue: 'false' },
      { key: 'max_results', label: 'Max matches', type: 'number', min: 1, max: 1000, step: 1, defaultValue: 200 },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Find files by glob pattern under a bounded local root...', defaultValue: 'Read-only glob search across a bounded local filesystem root.' },
    ],
    defaultParams: {
      root_path: '.',
      include_hidden: 'false',
      max_results: 200,
      description: 'Read-only glob search across a bounded local filesystem root.',
    },
  },

  tool_fs_grep: {
    type: 'tool_fs_grep',
    label: 'FS Grep',
    icon: Search,
    category: 'Tools',
    color: '#4ade80',
    gradient: 'linear-gradient(135deg, #4ade80, #16a34a)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'root_path', label: 'Root path', type: 'text', placeholder: '.', defaultValue: '.' },
      { key: 'file_glob', label: 'File glob', type: 'text', placeholder: '**/*', defaultValue: '**/*' },
      { key: 'case_sensitive', label: 'Case sensitive', type: 'select', options: [{ label: 'No', value: 'false' }, { label: 'Yes', value: 'true' }], defaultValue: 'false' },
      { key: 'include_hidden', label: 'Include hidden', type: 'select', options: [{ label: 'No', value: 'false' }, { label: 'Yes', value: 'true' }], defaultValue: 'false' },
      { key: 'max_matches', label: 'Max matches', type: 'number', min: 1, max: 5000, step: 1, defaultValue: 200 },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Search text patterns across files under a bounded local root...', defaultValue: 'Read-only grep-style text search across a bounded local filesystem root.' },
    ],
    defaultParams: {
      root_path: '.',
      file_glob: '**/*',
      case_sensitive: 'false',
      include_hidden: 'false',
      max_matches: 200,
      description: 'Read-only grep-style text search across a bounded local filesystem root.',
    },
  },



  tool_fs_write_file: {
    type: 'tool_fs_write_file',
    label: 'FS Write File',
    icon: FileUp,
    category: 'Tools',
    color: '#15803d',
    gradient: 'linear-gradient(135deg, #15803d, #14532d)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'root_path', label: 'Root path', type: 'text', placeholder: '.', defaultValue: '.' },
      { key: 'create_dirs', label: 'Create missing dirs', type: 'select', options: [{ label: 'No', value: 'false' }, { label: 'Yes', value: 'true' }], defaultValue: 'false' },
      { key: 'overwrite_existing', label: 'Overwrite existing', type: 'select', options: [{ label: 'No', value: 'false' }, { label: 'Yes', value: 'true' }], defaultValue: 'false' },
      { key: 'max_bytes', label: 'Max bytes', type: 'number', min: 32, max: 5000000, step: 32, defaultValue: 200000 },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Write one text file under a bounded local root...', defaultValue: 'Preview or apply one local text file under a bounded root path with explicit create-vs-overwrite and size guards.' },
    ],
    defaultParams: {
      root_path: '.',
      create_dirs: 'false',
      overwrite_existing: 'false',
      max_bytes: 200000,
      description: 'Preview or apply one local text file under a bounded root path with explicit create-vs-overwrite and size guards.',
    },
  },

  tool_fs_edit_file: {
    type: 'tool_fs_edit_file',
    label: 'FS Edit File',
    icon: Replace,
    category: 'Tools',
    color: '#16a34a',
    gradient: 'linear-gradient(135deg, #16a34a, #14532d)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'root_path', label: 'Root path', type: 'text', placeholder: '.', defaultValue: '.' },
      { key: 'replace_all', label: 'Replace all matches', type: 'select', options: [{ label: 'No', value: 'false' }, { label: 'Yes', value: 'true' }], defaultValue: 'false' },
      { key: 'max_bytes', label: 'Max bytes', type: 'number', min: 32, max: 5000000, step: 32, defaultValue: 200000 },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Edit one text file under a bounded local root...', defaultValue: 'Preview or apply one local text file edit under a bounded root path with explicit match-count and size guards.' },
    ],
    defaultParams: {
      root_path: '.',
      replace_all: 'false',
      max_bytes: 200000,
      description: 'Preview or apply one local text file edit under a bounded root path with explicit match-count and size guards.',
    },
  },

  tool_fs_apply_patch: {
    type: 'tool_fs_apply_patch',
    label: 'FS Apply Patch',
    icon: Scissors,
    category: 'Tools',
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, #22c55e, #166534)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'root_path', label: 'Root path', type: 'text', placeholder: '.', defaultValue: '.' },
      { key: 'allow_create', label: 'Allow file creation', type: 'select', options: [{ label: 'No', value: 'false' }, { label: 'Yes', value: 'true' }], defaultValue: 'false' },
      { key: 'create_dirs', label: 'Create missing dirs', type: 'select', options: [{ label: 'No', value: 'false' }, { label: 'Yes', value: 'true' }], defaultValue: 'false' },
      { key: 'max_files', label: 'Max files per patch', type: 'number', min: 1, max: 200, step: 1, defaultValue: 8 },
      { key: 'max_bytes', label: 'Max bytes per file', type: 'number', min: 32, max: 5000000, step: 32, defaultValue: 200000 },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Apply a bounded unified diff patch under a local root...', defaultValue: 'Preview or apply a bounded unified diff patch under a local root path with explicit touched-file, creation, rejection, and size guards.' },
    ],
    defaultParams: {
      root_path: '.',
      allow_create: 'false',
      create_dirs: 'false',
      max_files: 8,
      max_bytes: 200000,
      description: 'Preview or apply a bounded unified diff patch under a local root path with explicit touched-file, creation, rejection, and size guards.',
    },
  },

  tool_shell_command: {
    type: 'tool_shell_command',
    label: 'Shell Command',
    icon: Terminal,
    category: 'Tools',
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'root_path', label: 'Working root', type: 'text', placeholder: '.', defaultValue: '.' },
      { key: 'timeout_seconds', label: 'Timeout (s)', type: 'number', min: 1, max: 120, step: 1, defaultValue: 20 },
      { key: 'allowed_commands', label: 'Allowed commands', type: 'string-list', placeholder: 'python / pytest / ls' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'User-armed local shell command tool...', defaultValue: 'User-armed bounded local shell subprocess surface with cwd and command allowlist guards and explicit blocked/failed/succeeded results.' },
    ],
    defaultParams: {
      root_path: '.',
      timeout_seconds: 20,
      allowed_commands: ['python', 'python3', 'pytest', 'ls', 'pwd', 'grep', 'find', 'cat'],
      description: 'User-armed bounded local shell subprocess surface with cwd and command allowlist guards and explicit blocked/failed/succeeded results.',
    },
  },

  tool_sql_query: {
    type: 'tool_sql_query',
    label: 'SQL Query',
    icon: TableProperties,
    category: 'Tools',
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'db_path', label: 'SQLite path / URI', type: 'text', placeholder: 'data.db', defaultValue: 'data.db', required: true },
      { key: 'read_only', label: 'Mode', type: 'select', options: [{ label: 'Read-only', value: 'true' }, { label: 'Unsafe write (blocked)', value: 'false' }], defaultValue: 'true' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Run a read-only SQL query...', defaultValue: 'Read-only SQL execution against a local SQLite database.' },
    ],
    defaultParams: {
      db_path: 'data.db',
      read_only: 'true',
      description: 'Read-only SQL execution against a local SQLite database.',
    },
  },

  tool_sql_list_tables: {
    type: 'tool_sql_list_tables',
    label: 'SQL List Tables',
    icon: Database,
    category: 'Tools',
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, #14b8a6, #0f766e)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'db_path', label: 'SQLite path / URI', type: 'text', placeholder: 'data.db', defaultValue: 'data.db', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'List available tables...', defaultValue: 'Inspect available tables in the configured SQLite database.' },
    ],
    defaultParams: {
      db_path: 'data.db',
      description: 'Inspect available tables in the configured SQLite database.',
    },
  },

  tool_sql_get_schema: {
    type: 'tool_sql_get_schema',
    label: 'SQL Get Schema',
    icon: FileSearch,
    category: 'Tools',
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, #0f766e, #115e59)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'db_path', label: 'SQLite path / URI', type: 'text', placeholder: 'data.db', defaultValue: 'data.db', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Inspect the schema of one or more tables...', defaultValue: 'Inspect table schema in the configured SQLite database.' },
    ],
    defaultParams: {
      db_path: 'data.db',
      description: 'Inspect table schema in the configured SQLite database.',
    },
  },

  tool_sql_query_check: {
    type: 'tool_sql_query_check',
    label: 'SQL Query Check',
    icon: CheckCircle,
    category: 'Tools',
    color: '#0f766e',
    gradient: 'linear-gradient(135deg, #0f766e, #134e4a)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'db_path', label: 'SQLite path / URI', type: 'text', placeholder: 'data.db', defaultValue: 'data.db', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Validate a SQL query before execution...', defaultValue: 'Validate a SQL query against read-only SQLite rules.' },
    ],
    defaultParams: {
      db_path: 'data.db',
      description: 'Validate a SQL query against read-only SQLite rules.',
    },
  },

  tool_github_get_issue: {
    type: 'tool_github_get_issue',
    label: 'GitHub Get Issue',
    icon: GitBranch,
    category: 'Tools',
    color: '#64748b',
    gradient: 'linear-gradient(135deg, #64748b, #475569)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Read a GitHub issue...', defaultValue: 'Read one GitHub issue from the configured repository.' },
    ],
    defaultParams: {
      description: 'Read one GitHub issue from the configured repository.',
    },
  },

  tool_github_get_pull_request: {
    type: 'tool_github_get_pull_request',
    label: 'GitHub Get PR',
    icon: GitBranch,
    category: 'Tools',
    color: '#64748b',
    gradient: 'linear-gradient(135deg, #64748b, #334155)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Read a GitHub pull request...', defaultValue: 'Read one GitHub pull request from the configured repository.' },
    ],
    defaultParams: {
      description: 'Read one GitHub pull request from the configured repository.',
    },
  },

  tool_github_read_file: {
    type: 'tool_github_read_file',
    label: 'GitHub Read File',
    icon: FileText,
    category: 'Tools',
    color: '#64748b',
    gradient: 'linear-gradient(135deg, #475569, #334155)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Read a file from GitHub...', defaultValue: 'Read a file from the configured GitHub repository.' },
    ],
    defaultParams: {
      description: 'Read a file from the configured GitHub repository.',
    },
  },

  tool_github_search_issues_prs: {
    type: 'tool_github_search_issues_prs',
    label: 'GitHub Search Issues/PRs',
    icon: Search,
    category: 'Tools',
    color: '#64748b',
    gradient: 'linear-gradient(135deg, #475569, #1e293b)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Search issues and pull requests...', defaultValue: 'Search issues and pull requests in the configured GitHub repository.' },
    ],
    defaultParams: {
      description: 'Search issues and pull requests in the configured GitHub repository.',
    },
  },

  tool_python_function: {
    type: 'tool_python_function',
    label: 'Python Function',
    icon: FileCode,
    category: 'Tools',
    color: '#eab308',
    gradient: 'linear-gradient(135deg, #eab308, #ca8a04)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Description de la fonction...' },
      { key: 'code', label: 'Code Python', type: 'textarea', placeholder: 'def ma_fonction(arg: str) -> str:\n    """Docstring."""\n    return result' },
    ],
    defaultParams: {
      description: '',
      code: '',
    },
  },

  tool_rpg_dice_roller: {
    type: 'tool_rpg_dice_roller',
    label: 'RPG Dice Roller',
    icon: Dices,
    category: 'Tools',
    color: '#e879f9',
    gradient: 'linear-gradient(135deg, #e879f9, #c026d3)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Simule un jet de dés RPG...', defaultValue: 'Simule un jet de dés pour un jeu de rôle. L\'entrée doit utiliser la notation standard RPG, par exemple : \'1d20\', \'2d6\', ou \'3d8+2\'.' },
    ],
    defaultParams: {
      description: 'Simule un jet de dés pour un jeu de rôle. L\'entrée doit utiliser la notation standard RPG, par exemple : \'1d20\', \'2d6\', ou \'3d8+2\'.',
    },
  },

  tool_pw_navigate: {
    type: 'tool_pw_navigate',
    label: 'PW Navigate',
    icon: Globe,
    category: 'Playwright',
    color: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Navigue vers une URL...', defaultValue: 'Navigue vers une URL dans le navigateur Playwright.' },
    ],
    defaultParams: {
      description: 'Navigue vers une URL dans le navigateur Playwright.',
    },
  },

  tool_pw_click: {
    type: 'tool_pw_click',
    label: 'PW Click',
    icon: MousePointerClick,
    category: 'Playwright',
    color: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Clique sur un élément...', defaultValue: 'Clique sur un élément de la page via son sélecteur CSS.' },
    ],
    defaultParams: {
      description: 'Clique sur un élément de la page via son sélecteur CSS.',
    },
  },

  tool_pw_current_page: {
    type: 'tool_pw_current_page',
    label: 'PW Current Page',
    icon: MapPin,
    category: 'Playwright',
    color: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Retourne l\'URL et le titre de la page courante...', defaultValue: 'Retourne l\'URL et le titre de la page web courante.' },
    ],
    defaultParams: {
      description: 'Retourne l\'URL et le titre de la page web courante.',
    },
  },

  tool_pw_fill: {
    type: 'tool_pw_fill',
    label: 'PW Fill',
    icon: TextCursorInput,
    category: 'Playwright',
    color: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Remplit un champ de saisie...', defaultValue: 'Remplit un champ de saisie avec du texte via un sélecteur CSS (ex: input[name="q"], #search-input).' },
    ],
    defaultParams: {
      description: 'Remplit un champ de saisie avec du texte via un sélecteur CSS (ex: input[name="q"], #search-input).',
    },
  },

  tool_playwright_wait: {
    type: 'tool_playwright_wait',
    label: 'PW Wait',
    icon: Timer,
    category: 'Playwright',
    color: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Met le navigateur en pause...', defaultValue: 'Met le navigateur en pause pendant un nombre de secondes défini. À utiliser si la page indique "Chargement en cours..." ou si un élément n\'est pas encore apparu.' },
    ],
    defaultParams: {
      description: 'Met le navigateur en pause pendant un nombre de secondes défini. À utiliser si la page indique "Chargement en cours..." ou si un élément n\'est pas encore apparu.',
    },
  },

  tool_playwright_scroll: {
    type: 'tool_playwright_scroll',
    label: 'PW Scroll',
    icon: ArrowDownUp,
    category: 'Playwright',
    color: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Fait défiler la page...', defaultValue: 'Fait défiler la page d\'un écran vers le bas ou vers le haut. Indispensable pour les pages infinies.' },
    ],
    defaultParams: {
      description: 'Fait défiler la page d\'un écran vers le bas ou vers le haut. Indispensable pour les pages infinies.',
    },
  },

  tool_playwright_keypress: {
    type: 'tool_playwright_keypress',
    label: 'PW Keypress',
    icon: Keyboard,
    category: 'Playwright',
    color: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Simule l\'appui sur une touche...', defaultValue: 'Simule l\'appui sur une touche du clavier (Enter, Escape, Tab, ArrowDown, ArrowUp). Utile pour valider une recherche ou fermer un pop-up.' },
    ],
    defaultParams: {
      description: 'Simule l\'appui sur une touche du clavier (Enter, Escape, Tab, ArrowDown, ArrowUp). Utile pour valider une recherche ou fermer un pop-up.',
    },
  },

  tool_pw_extract_text: {
    type: 'tool_pw_extract_text',
    label: 'PWLG Extract Text',
    icon: FileSearch,
    category: 'PlaywrightLG',
    color: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Extrait le texte visible...', defaultValue: 'Extrait le texte visible de la page web courante.' },
    ],
    defaultParams: {
      description: 'Extrait le texte visible de la page web courante.',
    },
  },

  tool_pw_extract_links: {
    type: 'tool_pw_extract_links',
    label: 'PWLG Extract Links',
    icon: Link,
    category: 'PlaywrightLG',
    color: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Extrait les liens hypertexte (markdown)...', defaultValue: 'Extrait tous les liens hypertexte de la page web courante au format markdown.' },
    ],
    defaultParams: {
      description: 'Extrait tous les liens hypertexte de la page web courante au format markdown.',
    },
  },

  tool_pw_get_elements: {
    type: 'tool_pw_get_elements',
    label: 'PWLG Get Elements',
    icon: ScanSearch,
    category: 'PlaywrightLG',
    color: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Récupère les éléments par sélecteur CSS...', defaultValue: 'Récupère les éléments correspondant au sélecteur CSS sur la page courante.' },
    ],
    defaultParams: {
      description: 'Récupère les éléments correspondant au sélecteur CSS sur la page courante.',
    },
  },

  tool_playwright_extract_links: {
    type: 'tool_playwright_extract_links',
    label: 'PW Extract Links (Legacy)',
    icon: Link,
    category: 'PlaywrightLG',
    color: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Legacy Playwright link extraction...', defaultValue: 'Legacy Playwright link extraction surface kept for compatibility with older artifacts.' },
    ],
    defaultParams: {
      description: 'Legacy Playwright link extraction surface kept for compatibility with older artifacts.',
    },
  },

  tool_playwright_screenshot: {
    type: 'tool_playwright_screenshot',
    label: 'PWLG Screenshot',
    icon: Camera,
    category: 'PlaywrightLG',
    color: '#2dd4bf',
    gradient: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Capture d\'écran de la page...', defaultValue: 'Prend une capture d\'écran de la page actuelle. Retourne l\'image en base64 pour analyse par un modèle Vision.' },
    ],
    defaultParams: {
      description: 'Prend une capture d\'écran de la page actuelle. Retourne l\'image en base64 pour analyse par un modèle Vision.',
    },
  },

  tool_llm_worker: {
    type: 'tool_llm_worker',
    label: 'LLM Worker',
    icon: Bot,
    category: 'Tools',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Agent expert pour traiter une sous-tâche', defaultValue: 'Agent expert pour traiter une sous-tâche' },
      { key: 'system_prompt', label: 'System Prompt', type: 'textarea', placeholder: 'Tu es un assistant expert.', defaultValue: 'Tu es un assistant expert.' },
      {
        key: 'provider',
        label: 'Provider',
        type: 'select',
        options: SELECTABLE_PROVIDER_OPTIONS,
      },
      { key: 'model_name', label: 'Modèle', type: 'text', placeholder: 'gpt-4o-mini', defaultValue: 'gpt-4o-mini' },
      { key: 'api_key_env', label: 'Clé API (variable env)', type: 'text', placeholder: 'OPENAI_API_KEY', defaultValue: '' },
      { key: 'api_base_url', label: 'API Base URL', type: 'text', placeholder: 'http://127.0.0.1:1234/v1', defaultValue: '' },
      { key: 'execution_group', label: "Groupe d'exécution", type: 'text', placeholder: 'main', defaultValue: 'main' },
    ],
    advancedFields: [
      { key: 'max_tokens', label: 'Max Tokens', type: 'number', min: 1, max: 128000, step: 1, defaultValue: 2048 },
      { key: 'top_p', label: 'Top P', type: 'slider', min: 0, max: 1, step: 0.05, defaultValue: 1 },
      { key: 'frequency_penalty', label: 'Frequency Penalty', type: 'slider', min: -2, max: 2, step: 0.1, defaultValue: 0 },
      { key: 'presence_penalty', label: 'Presence Penalty', type: 'slider', min: -2, max: 2, step: 0.1, defaultValue: 0 },
      { key: 'stop_sequences', label: 'Stop Sequences', type: 'string-list', placeholder: 'séquence' },
      { key: 'temperature', label: 'Température', type: 'slider', min: 0, max: 2, step: 0.1, defaultValue: 0 },
    ],
    defaultParams: {
      description: 'Agent expert pour traiter une sous-tâche',
      system_prompt: 'Tu es un assistant expert.',
      provider: 'openai',
      model_name: 'gpt-4o-mini',
      api_key_env: '',
      api_base_url: '',
      execution_group: 'main',
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stop_sequences: [],
      temperature: 0,
    },
  },


  deep_agent_suite: {
    type: 'deep_agent_suite',
    label: 'Deep Agent Suite',
    icon: Layers,
    category: 'Flow',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    handles: [
      { id: 'data_in', label: 'In', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'tools_in', label: 'Tools', type: 'target', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
      { id: 'data_out', label: 'Out', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'target_subgraph', label: 'Artefact cible', type: 'text', placeholder: 'artifact:deep_agent/deep_agent_suite_starter', defaultValue: '' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Suite Deep Agents référencée comme wrapper conceptuel', defaultValue: 'Suite Deep Agents référencée comme wrapper conceptuel.' },
      {
        key: 'planning_mode',
        label: 'Planning mode',
        type: 'select',
        options: [
          { label: 'Plan / Execute', value: 'plan_execute' },
          { label: 'Reflective', value: 'reflective' },
          { label: 'Delegation-first', value: 'delegation_first' },
        ],
      },
    ],
    defaultParams: {
      target_subgraph: '',
      description: 'Suite Deep Agents référencée comme wrapper conceptuel.',
      planning_mode: 'plan_execute',
      wrapper_mode: 'transparent',
    },
  },

  deep_subagent_worker: {
    type: 'deep_subagent_worker',
    label: 'Deep Subagent Worker',
    icon: Bot,
    category: 'Tools',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Worker expert spécialisé pour sous-tâche', defaultValue: 'Worker expert spécialisé pour sous-tâche.' },
      { key: 'system_prompt', label: 'System Prompt', type: 'textarea', placeholder: 'Tu es un spécialiste mobilisable par une suite Deep Agents.', defaultValue: 'Tu es un spécialiste mobilisable par une suite Deep Agents.' },
      {
        key: 'provider',
        label: 'Provider',
        type: 'select',
        options: SELECTABLE_PROVIDER_OPTIONS,
      },
      { key: 'model_name', label: 'Modèle', type: 'text', placeholder: 'gpt-4o-mini', defaultValue: 'gpt-4o-mini' },
      { key: 'execution_group', label: "Groupe d'exécution", type: 'text', placeholder: 'delegates', defaultValue: 'delegates' },
    ],
    defaultParams: {
      description: 'Worker expert spécialisé pour sous-tâche.',
      system_prompt: 'Tu es un spécialiste mobilisable par une suite Deep Agents.',
      provider: 'openai',
      model_name: 'gpt-4o-mini',
      execution_group: 'delegates',
    },
  },

  deep_memory_skill: {
    type: 'deep_memory_skill',
    label: 'Deep Memory Skill',
    icon: BookOpen,
    category: 'Memory',
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, #14b8a6, #0f766e)',
    handles: [
      { id: 'data_in', label: 'In', type: 'target', position: 'left', color: MODALITY_COLORS.any, modality: 'any' },
      { id: 'data_out', label: 'Out', type: 'source', position: 'right', color: MODALITY_COLORS.any, modality: 'any' },
    ],
    fields: [
      { key: 'namespace_prefix', label: 'Namespace prefix', type: 'text', placeholder: 'deep_agent_profiles', defaultValue: 'deep_agent_profiles' },
      { key: 'user_id_key', label: 'User ID key', type: 'text', placeholder: 'user_id', defaultValue: 'user_id' },
      { key: 'output_key', label: 'Output key', type: 'text', placeholder: 'memory_data', defaultValue: 'memory_data' },
    ],
    defaultParams: {
      namespace_prefix: 'deep_agent_profiles',
      user_id_key: 'user_id',
      output_key: 'memory_data',
    },
  },

  tool_sub_agent: {
    type: 'tool_sub_agent',
    label: 'Subagent',
    icon: Boxes,
    category: 'Tools',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899, #db2777)',
    isTool: true,
    handles: [
      { id: 'tool_out', label: 'Tool', type: 'source', position: 'left', color: MODALITY_COLORS.tool_call, modality: 'tool_call' },
    ],
    fields: [
      { key: 'target_group', label: 'Groupe', type: 'text', placeholder: 'Sélection assistée', defaultValue: 'default' },
      { key: 'target_agent', label: 'Sous-agent', type: 'text', placeholder: 'research_agent (optionnel)', defaultValue: '' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Appelle un agent expert pour...', defaultValue: 'Appelle un agent expert pour résoudre une sous-tâche.' },
    ],
    advancedFields: [
      { key: 'max_invocations', label: 'Max invocations', type: 'number', min: 1, max: 10, step: 1, defaultValue: 1 },
      { key: 'allow_repeat', label: 'Répétitions autorisées', type: 'select', options: [{ label: 'Non', value: '' }, { label: 'Oui', value: 'true' }], defaultValue: '' },
      {
        key: 'provider',
        label: 'Provider',
        type: 'select',
        options: SELECTABLE_PROVIDER_OPTIONS,
        defaultValue: 'openai',
      },
      { key: 'model_name', label: 'Modèle', type: 'text', placeholder: 'gpt-4o-mini' },
      { key: 'api_key_env', label: 'Clé API (variable env)', type: 'text', placeholder: 'OPENAI_API_KEY' },
      { key: 'api_base_url', label: 'API Base URL', type: 'text', placeholder: 'http://127.0.0.1:1234/v1', defaultValue: '' },
      { key: 'max_tokens', label: 'Max Tokens', type: 'number', min: 1, max: 128000, step: 1, defaultValue: 2048 },
      { key: 'top_p', label: 'Top P', type: 'slider', min: 0, max: 1, step: 0.05, defaultValue: 1 },
      { key: 'frequency_penalty', label: 'Frequency Penalty', type: 'slider', min: -2, max: 2, step: 0.1, defaultValue: 0 },
      { key: 'presence_penalty', label: 'Presence Penalty', type: 'slider', min: -2, max: 2, step: 0.1, defaultValue: 0 },
      { key: 'stop_sequences', label: 'Stop Sequences', type: 'string-list', placeholder: 'séquence' },
      { key: 'temperature', label: 'Température', type: 'slider', min: 0, max: 2, step: 0.1, defaultValue: 0.3 },
    ],
    defaultParams: {
      target_group: 'default',
      target_agent: '',
      description: 'Appelle un agent expert pour résoudre une sous-tâche.',
      max_invocations: 1,
      allow_repeat: '',
      provider: 'openai',
      model_name: 'gpt-4o-mini',
      api_key_env: '',
      api_base_url: '',
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stop_sequences: [],
      temperature: 0.3,
    },
  },
};
