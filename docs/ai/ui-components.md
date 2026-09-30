# Componentes de UI

## Objetivo

A camada `frontend/src/components/ui/` reúne primitivas reutilizáveis para manter telas consistentes e com comportamento de acessibilidade compartilhado. Prefira estes componentes antes de criar botões, campos de entrada, modais, badges, alertas ou estados de carregamento diretamente nas telas. O guia público de arquitetura está em [../architecture.md](../architecture.md).

## Arquitetura

- `Button.jsx`: ações com variantes visuais, estado de carregamento, ícones e foco acessível.
- `CopySnippet.jsx`: bloco de código/comando com ação de copiar e alternativa para área de transferência.
- `TextField.jsx`: campo com rótulo, dica, erro, ícone inicial, acento visual e atributos ARIA.
- `Modal.jsx`: diálogo acessível com `role="dialog"`, `aria-modal`, Escape, trap de foco, restauração de foco e bloqueio de scroll.
- `Alert.jsx`: mensagens de retorno em linha com tom semântico, ícone e ação opcional.
- `Badge.jsx`: etiqueta semântica pequena para metadados, contadores e flags.
- `StatusBadge.jsx`: componente de status comuns (`completed`, `failed`, `processing`, `connected`, etc.).
- `LoadingState.jsx`: carregamento acessível com `role="status"` para áreas de conteúdo.
- `EmptyState.jsx`: estado vazio responsivo para listas/tabelas.
- `Card.jsx`: superfície base e subcomponentes de cabeçalho/título/descrição.
- `Spinner.jsx`: indicador de carregamento com `aria-hidden`.
- `BrandIcons.jsx`: ícones Spotify/YouTube reutilizáveis.
- `ProviderIcon.jsx`: ícone visual por provedor, incluindo os sete destinos/origens registrados.
- `FadeInPage.jsx`: componente de entrada para páginas/abas.
- `utils/cn.js`: mescla segura de classes Tailwind com `clsx` e `tailwind-merge`.

## Propriedades Principais

### Button

- `variant`: `primary`, `youtube`, `secondary`, `ghost`, `danger`, `inverse`.
- `size`: `sm`, `md`, `lg`.
- `loading`: desabilita o botão, mostra spinner e aplica `aria-busy`.
- `loadingLabel`: texto durante carregamento.
- `leftIcon` / `rightIcon`: ícones decorativos/operacionais.
- `fullWidth`: ocupa toda a largura.

### CopySnippet

- `code`: texto exato a copiar.
- `label`: rótulo curto exibido no topo do bloco, como `backend/.env`.
- `language`: classe semântica para o conteúdo do `<code>`, padrão `bash`.
- Use em tutoriais locais e snippets com valores demonstrativos. Nunca renderize tokens, cookies ou segredos reais.

### TextField

- `label`: conecta `label` e `input` por `htmlFor`.
- `labelAction`: ação contextual alinhada ao label, como abrir a ajuda de configuração.
- `hint`: texto auxiliar conectado por `aria-describedby`.
- `error`: marca `aria-invalid` e renderiza mensagem com `role="alert"`.
- `leadingIcon`: ícone no início do campo.
- `tone`: `spotify`, `youtube` ou `neutral`.
- `trailingElement`: elemento interativo ou decorativo no fim do campo.
- Aceita propriedades nativas de `input`, como `type`, `value`, `onChange`, `placeholder`, `autoComplete`, `minLength` e `inputMode`.

### Modal

- `isOpen`: controla renderização.
- `onClose`: acionado por botão, fundo do modal e tecla Escape.
- `title` / `description`: conectados via `aria-labelledby` e `aria-describedby`.
- `footer`: área de ações.
- `size`: `sm`, `md`, `lg`.
- Mantém foco dentro do diálogo com Tab/Shift+Tab e restaura o foco ao fechar.

### Alert

- `tone`: `neutral`, `success`, `warning`, `danger`, `youtube`.
- `title`: título curto opcional.
- `children`: descrição ou conteúdo rico.
- `action`: chamada para ação opcional abaixo da mensagem.
- `role`: sobrescreve o papel ARIA; por padrão usa `alert` para `danger` e `status` nos demais.

### Badge

- `tone`: `neutral`, `success`, `warning`, `danger`, `info`, `spotify`, `youtube`.
- `size`: `sm`, `md`.
- `icon`: ícone opcional.
- `as`: elemento HTML opcional, padrão `span`.

### StatusBadge

- `status`: `completed`, `connected`, `failed`, `disconnected`, `pending`, `processing`, `queued`, `paused` e `needs_auth`.
- `label`: sobrescreve o texto do padrão.
- `tone` / `icon`: sobrescrevem a aparência do padrão quando necessário.

### LoadingState

- `label`: texto anunciado por leitores de tela.
- `description`: detalhe opcional.
- `size`: `sm` ou `md`.
- Use dentro de cards, tabelas e painéis enquanto dados reais são buscados.

## Exemplos

```jsx
import { Search, Save } from 'lucide-react';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

<TextField
  label="Buscar playlist"
  value={searchTerm}
  onChange={(event) => setSearchTerm(event.target.value)}
  leadingIcon={<Search size={18} />}
  placeholder="Buscar playlist..."
/>

<Button
  variant="primary"
  loading={saving}
  loadingLabel="Salvando..."
  rightIcon={<Save size={16} />}
  onClick={handleSave}
>
  Salvar
</Button>
```

```jsx
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import TextField from '../ui/TextField';

<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="Iniciar migração"
  description="Cole o ID global da playlist para enfileirar a conversão."
  footer={<Button onClick={onConfirm}>Confirmar</Button>}
>
  <TextField label="ID da playlist" value={playlistId} onChange={handleChange} />
</Modal>
```

```jsx
import Alert from '../ui/Alert';
import StatusBadge from '../ui/StatusBadge';
import LoadingState from '../ui/LoadingState';

{loading ? (
  <LoadingState
    label="Carregando histórico..."
    description="Buscando suas migrações recentes."
  />
) : (
  <StatusBadge status={transfer.status} />
)}

<Alert tone="warning" title="Playlist privada">
  O Spotify pode bloquear faixas de playlists sem permissão de leitura.
</Alert>
```

```jsx
import Badge from '../ui/Badge';
import LoadingState from '../ui/LoadingState';

<Badge tone="spotify">Conectado</Badge>

<div aria-busy="true" aria-label="Carregando playlists">
  <LoadingState label="Carregando playlists..." size="sm" />
</div>
```

## Boas Práticas

- Use `loading` no `Button` para ações assíncronas em vez de montar indicadores manualmente.
- Sempre forneça `label` ou `aria-label` para campos.
- Use `tone="youtube"` em campos de entrada e alertas de fluxos do YouTube Music para preservar contexto visual.
- Use `StatusBadge` para status de transferência e conexão antes de criar `span`s personalizados.
- Use `LoadingState` para carregamentos de regiões, listas e cards.
- Em listas/tabelas vazias, prefira `EmptyState` com título e descrição acionável.
- Evite aninhar cards dentro de cards; use `Card` apenas para superfícies independentes.
- Mantenha textos curtos em botões para preservar responsividade.
