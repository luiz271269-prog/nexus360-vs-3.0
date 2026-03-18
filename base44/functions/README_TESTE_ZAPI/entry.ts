# 🧪 Script de Teste Automatizado Z-API

## Descrição

Este script testa a capacidade de **envio de mensagens** da Z-API de forma completamente isolada do VendaPro. É uma ferramenta essencial para validar que a Z-API está configurada corretamente antes de integrar com a aplicação.

## Por que este teste é importante?

- ✅ **Valida a Z-API isoladamente** - Remove o VendaPro da equação para identificar se o problema está na API ou na integração
- ✅ **Feedback claro** - Códigos de saída e mensagens detalhadas
- ✅ **Diagnóstico automático** - Sugere possíveis causas de falha
- ✅ **Pronto para CI/CD** - Pode ser integrado em pipelines de teste

## Como Usar

### 1. Configure as Variáveis de Ambiente

```bash
export INSTANCE_ID=3E5D2BD1BF421127B24ECEF0269361A3
export TOKEN=F91DB8300CE1967F7F6403F6
export PHONE_TESTE=5548999999999
```

Ou edite diretamente o arquivo `teste-zapi.js` (linhas 24-27).

### 2. Execute o Script

```bash
deno run --allow-net --allow-env functions/teste-zapi.js
```

### 3. Interprete o Resultado

#### ✅ Sucesso (Exit Code 0)
```
✅ [SUCESSO] Mensagem enviada com sucesso!
   Message ID: ABC123XYZ
🎉 A Z-API está funcionando perfeitamente!
```

**Ação:** A Z-API está operacional. Se o VendaPro ainda não envia mensagens, o problema está na integração do VendaPro com a função de backend.

#### ❌ Falha - sent=false (Exit Code 1)
```
❌ [FALHA] Z-API retornou sucesso HTTP, mas sent=false
   Motivo: Dispositivo offline
```

**Possíveis Causas:**
- Smartphone desconectado do WhatsApp Web
- Número de telefone inválido
- Instância pausada ou bloqueada

**Ação:** Verifique o status da sua instância no painel da Z-API.

#### ❌ Erro HTTP (Exit Code 1)
```
❌ [FALHA] Status HTTP 401
   Resposta: {"error": "Unauthorized"}
```

**Possíveis Causas:**
- Token ou Instance ID incorretos
- Falta `Client-Token` no header (se sua conta Z-API exigir)

**Ação:** Valide suas credenciais no painel da Z-API.

#### ❌ Erro de Rede (Exit Code 2)
```
❌ [ERRO] Erro na requisição: fetch failed
```

**Possíveis Causas:**
- Sem conexão com a internet
- URL da API incorreta
- Firewall bloqueando a requisição

**Ação:** Verifique sua conectividade e configuração de rede.

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição | Exemplo |
|----------|-------------|-----------|---------|
| `INSTANCE_ID` | ✅ | ID da instância Z-API | `3E5D2BD1BF421127B24ECEF0269361A3` |
| `TOKEN` | ✅ | Token da instância (vai na URL) | `F91DB8300CE1967F7F6403F6` |
| `PHONE_TESTE` | ✅ | Número WhatsApp para teste | `5548999999999` |
| `BASE_URL` | ❌ | URL base da Z-API | `https://api.z-api.io` (padrão) |

## Códigos de Saída

| Código | Significado | Ação |
|--------|-------------|------|
| `0` | Sucesso | Z-API operacional ✅ |
| `1` | Falha no envio | Verificar configuração Z-API 🔧 |
| `2` | Erro na requisição | Verificar rede/credenciais 🌐 |

## Integração com CI/CD

### GitHub Actions
```yaml
- name: Testar Z-API
  run: |
    export INSTANCE_ID=${{ secrets.ZAPI_INSTANCE_ID }}
    export TOKEN=${{ secrets.ZAPI_TOKEN }}
    export PHONE_TESTE=${{ secrets.PHONE_TESTE }}
    deno run --allow-net --allow-env functions/teste-zapi.js
```

### GitLab CI
```yaml
test_zapi:
  script:
    - export INSTANCE_ID=$ZAPI_INSTANCE_ID
    - export TOKEN=$ZAPI_TOKEN
    - export PHONE_TESTE=$PHONE_TESTE
    - deno run --allow-net --allow-env functions/teste-zapi.js
```

## Troubleshooting

### "SUA_INSTANCE_ID_AQUI" aparece no erro
❌ Você não configurou as variáveis de ambiente.

**Solução:** Execute os comandos `export` mencionados na seção "Como Usar".

### Timeout após 30 segundos
❌ A Z-API não está respondendo.

**Solução:** 
- Verifique se a URL base está correta
- Teste se você consegue acessar `https://api.z-api.io` no navegador
- Aguarde alguns minutos e tente novamente

### "sent": false, mas sem erro específico
❌ A Z-API aceita a requisição mas não consegue entregar.

**Solução:**
- Verifique se o smartphone está conectado ao WhatsApp Web
- Confirme que o número de teste está correto (formato: 55DDD9XXXXXXXX)
- Acesse o painel da Z-API e verifique o status da instância

## Próximos Passos

### Se o teste passou (✅)
1. A Z-API está funcionando perfeitamente
2. Prossiga para testar o envio via interface do VendaPro
3. Se o VendaPro falhar, o problema está na função `enviarWhatsApp.js` ou na forma como o frontend a invoca

### Se o teste falhou (❌)
1. Corrija o problema apontado pelo script
2. Execute o teste novamente até obter sucesso
3. Somente após o sucesso, teste via VendaPro

## Suporte

Se este teste continuar falhando após todas as verificações:
1. Entre em contato com o suporte da Z-API
2. Verifique a [documentação oficial](https://developer.z-api.io/)
3. Confirme se sua conta Z-API está ativa e com créditos (se aplicável)