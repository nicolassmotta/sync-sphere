# Formatos de arquivo

[Índice da documentação](README.md)

Arquivo é um provedor de listas de metadados. Você pode importar, exportar e converter formatos sem conectar uma plataforma de música. O aplicativo não inclui áudio nesses arquivos.

Para começar, importe [playlist.csv](examples/playlist.csv). O exemplo tem três faixas fictícias.

## CSV

O parser aceita vírgula, ponto e vírgula ou tabulação, campos entre aspas, aspas escapadas e quebras de linha dentro de campos. A coluna de nome da faixa é obrigatória.

```csv
Track Name,Artist Name(s),Album Name,ISRC,Duration (ms)
Horizonte,Banda Aurora,Demonstração,,180000
Perto do Sol,Duo Norte,Demonstração,,210000
```

Também aceita cabeçalhos como `name`, `title`, `música`, `artist`, `artista`, `album`, `isrc` e `duration_ms`. O CSV do Exportify é reconhecido pelos cabeçalhos de faixa, artistas, álbum, duração e ISRC.

| Campo | Recomendação |
|---|---|
| Nome | Preencha o título da faixa. |
| Artista | Use texto; vários artistas podem ser separados por vírgula dentro de um campo com aspas. |
| Álbum | Opcional. |
| ISRC | Opcional; informe apenas um identificador real da gravação. |
| Duração | Prefira milissegundos com cabeçalho explícito, como `Duration (ms)`. |

O CSV exportado usa os cabeçalhos `Track Name`, `Artist Name(s)`, `Album Name`, `ISRC` e `Duration (ms)` e codificação UTF-8 com BOM.

## JSON

Aceita um objeto com `tracks` ou uma lista simples de faixas:

```json
{
  "name": "Playlist demonstrativa",
  "description": "Três faixas fictícias para testar conversão",
  "tracks": [
    {
      "name": "Horizonte",
      "artist": "Banda Aurora",
      "album": "Demonstração",
      "durationMs": 180000
    }
  ]
}
```

Cada faixa também pode usar `title` no lugar de `name`, `artists` como lista e `duration_ms` no lugar de `durationMs`. O JSON exportado inclui `name`, `description`, `exportedBy: "SyncSphere"` e `tracks`.

## M3U e M3U8

Aceita `#EXTM3U`, nome com `#PLAYLIST:` e metadados com `#EXTINF:`:

```text
#EXTM3U
#PLAYLIST:Playlist demonstrativa
#EXTINF:180,Banda Aurora - Horizonte
Banda Aurora - Horizonte
```

Sem `#EXTINF`, o importador tenta extrair `Artista - Título` do nome do arquivo informado na linha. Caminhos são tratados como texto; o aplicativo não abre nem envia esses arquivos de áudio.

A exportação tem extensão `.m3u8` e lista os metadados das faixas. Ela não inventa caminhos de áudio válidos para um player.

## TXT

Uma faixa por linha, no formato `Artista - Título`:

```text
Banda Aurora - Horizonte
Duo Norte - Perto do Sol
Quarteto Rota - Noite Livre
```

Numeração como `1. ` ou `2) ` é aceita. Sem separador de artista, a linha inteira vira o título e o artista recebe `Unknown`.

## Duração e dados ausentes

Campos genéricos de duração aceitam `mm:ss` ou `hh:mm:ss`. Valores numéricos genéricos usam uma heurística entre segundos e milissegundos; para evitar ambiguidade, use `durationMs` no JSON ou `Duration (ms)` no CSV.

Faixas sem nome são ignoradas. Campos de álbum, duração e ISRC podem ficar vazios. Metadados incompletos podem reduzir a qualidade da busca em uma plataforma de música.

## Limites e armazenamento

- Importação: até 5 MB e 5.000 faixas válidas.
- São mantidas até 200 importações recentes na biblioteca local.
- Importações e exportações ficam cifradas no diretório de dados.
- Repetições intencionais são preservadas na conversão Arquivo -> Arquivo.
- Arquivos acima do limite de faixas são recusados, em vez de cortados silenciosamente.

Os resultados são listas de referências e metadados. Confira se o aplicativo para o qual pretende levar o arquivo aceita esse formato e seus campos.
