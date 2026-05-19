# Migração para Lucia Auth

## Visão Geral

O auth-ms foi migrado de gerenciamento manual de JWT para Lucia Auth v3 com PostgreSQL, implementando:
- Sessões gerenciadas pelo Lucia (substituindo JWT manual)
- 2FA por email com verificação de dispositivo confiável
- Validação de WhatsApp via QR code
- Proteção contra brute force com auth_attempts

## Fluxo de Autenticação

### Login

```
1. Usuário envia email + password
2. Validação de credenciais via user-ms
3. Verifica necessidade de 2FA:
   a. Email não verificado → requer 2FA
   b. Dispositivo não confiável → requer 2FA
   c. Dispositivo confiável → login direto
4. Cria sessão Lucia (twoFaVerified = false se 2FA necessário)
5. Se 2FA necessário, gera código de verificação por email
6. Retorna SessionData com twoFaRequired flag
```

### Verificação 2FA

```
1. Usuário recebe código por email (6 dígitos, expira 10 min)
2. Envia código + sessionId + deviceFingerprint
3. Sistema valida código na tabela email_verification_codes
4. Se válido:
   a. Marca código como usado
   b. Atualiza sessão: twoFaVerified = true
   c. Adiciona dispositivo como confiável (se deviceFingerprint fornecido)
5. Próximo login com mesmo dispositivo → pula 2FA
```

### Validação WhatsApp

```
1. Usuário solicita código WhatsApp
2. Sistema gera código 6 dígitos (expira 5 min)
3. Gera QR code contendo: nota-zip:verify:{code}:{userId}
4. Usuário escaneia QR code no WhatsApp
5. Sistema recebe código e valida
6. Marca phoneVerified = true no usuário
```

## Schema do Banco (auth_ms)

### users
| Campo | Tipo | Descrição |
|---|---|---|
| id | text PK | ID gerado pelo Lucia |
| email | text UNIQUE | Email do usuário |
| emailVerified | boolean | Email verificado |
| phoneVerified | boolean | Telefone verificado |
| tenant | text | Tenant (multi-tenant) |
| planId | text | Plano do usuário |
| roles | text (JSON) | Array de roles |

### sessions
| Campo | Tipo | Descrição |
|---|---|---|
| id | text PK | ID da sessão Lucia |
| userId | text FK | Referência ao user |
| expiresAt | timestamp | Expiração (30 dias) |
| ipAddress | text | IP do login |
| userAgent | text | User agent |
| deviceFingerprint | text | Fingerprint do dispositivo |
| authMethod | text | Método de autenticação |
| twoFaVerified | boolean | 2FA verificado |

### keys
| Campo | Tipo | Descrição |
|---|---|---|
| id | text PK | Formato: "email:{email}" |
| userId | text FK | Referência ao user |
| type | text | Tipo da chave (email) |
| hashedPassword | text | Senha hashada (Argon2) |

### trusted_devices
| Campo | Tipo | Descrição |
|---|---|---|
| id | serial PK | ID auto-incremento |
| userId | text FK | Referência ao user |
| deviceFingerprint | text | Fingerprint único |
| deviceName | text | Nome do dispositivo |
| lastUsedAt | timestamp | Último uso |

### email_verification_codes
| Campo | Tipo | Descrição |
|---|---|---|
| id | serial PK | ID auto-incremento |
| userId | text FK | Referência ao user |
| code | text | Código 6 dígitos |
| expiresAt | timestamp | Expiração (10 min) |
| used | boolean | Código já utilizado |

### whatsapp_verification_codes
| Campo | Tipo | Descrição |
|---|---|---|
| id | serial PK | ID auto-incremento |
| userId | text FK | Referência ao user |
| code | text | Código 6 dígitos |
| expiresAt | timestamp | Expiração (5 min) |
| used | boolean | Código já utilizado |

### auth_attempts
| Campo | Tipo | Descrição |
|---|---|---|
| id | serial PK | ID auto-incremento |
| email | text | Email da tentativa |
| ipAddress | text | IP da tentativa |
| success | boolean | Tentativa bem sucedida |
| attemptCount | integer | Contador de tentativas |
| lockedUntil | timestamp | Bloqueio até (rate limit) |

## Dependências Adicionadas

- `lucia` - Framework de autenticação
- `@lucia-auth/adapter-drizzle` - Adapter para Drizzle ORM
- `@node-rs/argon2` - Hash de senhas
- `pg` - Driver PostgreSQL
- `qrcode` - Geração de QR code

## Código Removido

- `tokenService.ts` - Gerenciamento manual de JWT
- `authService.ts` - Gerenciamento manual de sessões
- `authSessionRepository.ts` - Repositório de sessões SQLite
- `mfaSettingsRepository.ts` - Settings MFA (TOTP/WebAuthn/backup codes)
- Tabela `authSessions` - Substituída por Lucia sessions
- Tabela `mfaSettings` - Substituída por email_verification_codes + trusted_devices

## API de Autenticação

### POST /api/auth/login
```json
Request:  { "email": "...", "password": "...", "deviceFingerprint": "..." }
Response: { "sessionId": "...", "accessToken": "...", "twoFaRequired": true/false }
```

### POST /api/auth/verify-mfa
```json
Request:  { "sessionId": "...", "code": "123456", "deviceFingerprint": "..." }
Response: { "valid": true }
```

### POST /api/auth/whatsapp/generate-code
```json
Request:  { "userId": "..." }
Response: { "code": "ABC123", "qrCode": "data:image/png;base64,...", "expiresAt": "..." }
```

### POST /api/auth/whatsapp/validate-code
```json
Request:  { "userId": "...", "code": "ABC123" }
Response: { "valid": true, "message": "Phone verified successfully" }
```
