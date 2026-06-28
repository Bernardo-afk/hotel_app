# STAY — Sistema de Gestão de Limpeza para Airbnbs

SaaS multi-tenant para gestoras de Airbnb. Organiza equipes de limpeza, calcula urgência de apartamentos por checkout/checkin, gerencia realocações e gera relatórios fotográficos.

## Hierarquia de usuários

```
SUPER_ADMIN → MANAGER → ADM → COORDINATOR → CLEANER
```

---

## Rodando localmente

### Pré-requisitos

- Node.js 20+
- Docker + Docker Compose
- npm 10+

### 1. Clone e instale dependências

```bash
git clone https://github.com/Bernardo-afk/hotel_app.git
cd hotel_app

# Instala dependências de todos os workspaces
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example apps/backend/.env
# Edite apps/backend/.env com suas credenciais
```

### 3. Suba os serviços de infraestrutura

```bash
docker-compose up -d
```

Serviços disponíveis:
| Serviço | URL | Credenciais |
|---|---|---|
| PostgreSQL | `localhost:5432` | `stay / stay` |
| Redis | `localhost:6379` | — |
| pgAdmin | `http://localhost:5050` | `admin@stay.local / admin` |

> No pgAdmin, adicione o servidor com host `postgres`, porta `5432`, usuário `stay`, senha `stay`.

### 4. Rode as migrations do banco

```bash
cd apps/backend
npx prisma migrate dev
npx prisma generate
```

### 5. Inicie o backend

```bash
# Na raiz do projeto
npm run dev:backend

# Ou diretamente
cd apps/backend
npm run dev
```

O backend estará em `http://localhost:3000`.

### 6. Inicie o frontend web (opcional)

```bash
cd apps/web
npm run dev
```

O dashboard estará em `http://localhost:5173`.

### 7. Inicie o app mobile (opcional)

```bash
cd apps/mobile
npx expo start
```

Escaneie o QR code com o Expo Go (iOS/Android).

---

## Configurando os serviços externos

### PostgreSQL (via Docker)
Já incluído no `docker-compose.yml`. A `DATABASE_URL` padrão é:
```
postgresql://stay:stay@localhost:5432/stay_dev
```

### AWS S3 (upload de fotos e vídeos)

1. Crie um bucket S3 na AWS
2. Crie um usuário IAM com permissão `AmazonS3FullAccess` (ou política mínima de leitura/escrita no bucket)
3. Gere as chaves de acesso e preencha no `.env`:
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=nome-do-seu-bucket
AWS_REGION=us-east-1
```

### Firebase (push notifications)

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Crie um projeto e vá em **Configurações do projeto → Contas de serviço**
3. Clique em **Gerar nova chave privada** — baixa um JSON
4. Preencha no `.env`:
```
FIREBASE_PROJECT_ID=seu-projeto-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@seu-projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Anthropic (OCR de comprovantes de transporte)

1. Crie uma conta em [console.anthropic.com](https://console.anthropic.com/)
2. Gere uma API Key
3. Preencha no `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```
O sistema usa `claude-sonnet-4-6` para extrair valor e tipo de transporte de fotos de comprovantes.

### WhatsApp via Z-API + n8n (notificações fallback)

1. Configure uma instância no [Z-API](https://www.z-api.io/)
2. Configure um webhook no [n8n](https://n8n.io/) para encaminhar mensagens
3. Preencha no `.env`:
```
ZAPI_INSTANCE=sua-instancia
ZAPI_TOKEN=seu-token
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/stay
```

---

## Estrutura do projeto

```
stay/
├── apps/
│   ├── backend/                  # API REST (Node.js + Express + Prisma)
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Schema do banco de dados
│   │   └── src/
│   │       ├── modules/          # Módulos isolados por domínio
│   │       │   ├── auth/
│   │       │   ├── users/
│   │       │   ├── cleaning-jobs/
│   │       │   ├── assignments/
│   │       │   ├── transport/
│   │       │   ├── reports/
│   │       │   ├── incidents/
│   │       │   ├── relocations/
│   │       │   ├── candidacies/
│   │       │   ├── availability/
│   │       │   ├── dashboard/
│   │       │   ├── ocr/
│   │       │   ├── notifications/
│   │       │   ├── crons/
│   │       │   └── ...
│   │       ├── middleware/       # Auth, tenant isolation, role guard
│   │       └── lib/              # Prisma, S3, Haversine
│   │
│   ├── web/                      # Dashboard web (React + Vite + Tailwind)
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── coordinator/  # Dashboard do coordinator
│   │       │   └── adm/          # Dashboard do ADM
│   │       └── store/            # Zustand auth store
│   │
│   └── mobile/                   # App CLEANER (React Native + Expo)
│       └── src/
│           ├── screens/
│           │   ├── auth/         # Login, Register
│           │   ├── home/         # Home, AptDetail, TransportRegister
│           │   ├── cleaning/     # DoorWarning, InProgress, ReportIncident, Complete, WellDone
│           │   ├── guest/        # GuestPresent
│           │   ├── standby/      # RelocationAlert, HomeAfterRelocation
│           │   ├── search/       # SearchApts (candidaturas)
│           │   ├── history/      # History, HistoryDetail
│           │   └── profile/      # Profile, Availability
│           ├── navigation/       # RootNavigator, BottomTabs
│           ├── api/              # Axios com interceptors
│           └── store/            # Zustand + SecureStore
│
├── docker-compose.yml
├── .env.example
└── package.json                  # Workspace root
```

---

## Endpoints principais

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/login` | Login com phone/password/tenantId |
| POST | `/auth/refresh` | Renovar access token |
| POST | `/users/register-with-token` | Cadastro via convite |

### Cleaning Jobs
| Método | Rota | Descrição |
|---|---|---|
| GET | `/cleaning-jobs` | Listar jobs (filtrado por role) |
| GET | `/cleaning-jobs/:id` | Detalhe do job |
| PATCH | `/cleaning-jobs/:id/cancel` | Cancelar job |

### Assignments (fluxo de limpeza)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/assignments/:id/door-knocked` | Bateu na porta |
| POST | `/assignments/:id/start` | Iniciou limpeza |
| POST | `/assignments/:id/guest-present` | Hóspede no quarto |
| POST | `/assignments/:id/cant-finish` | Não conseguiu finalizar |
| PATCH | `/assignments/reorder` | Reordenar fila (coordinator) |

### Relatórios e mídia
| Método | Rota | Descrição |
|---|---|---|
| POST | `/reports/assignments/:id/complete` | Concluir limpeza (multipart: foto obrigatória, vídeo opcional) |
| POST | `/incidents` | Registrar ocorrência (multipart) |
| GET | `/media/jobs/:jobId` | Listar mídias do job |
| POST | `/ocr/extract` | Extrair valor de comprovante (base64) |

### Dashboard
| Método | Rota | Descrição |
|---|---|---|
| GET | `/dashboard` | Métricas coordinator |
| GET | `/dashboard/adm` | Métricas ADM |
| GET | `/dashboard/coordinator/:id` | Coordinator específico (ADM) |
| GET | `/dashboard/alert-strip` | Alertas ativos |

### Outros
| Método | Rota | Descrição |
|---|---|---|
| POST | `/transport` | Registrar transporte usado |
| POST | `/candidacies` | Candidatura para job (CLEANER) |
| GET | `/availability/:cleanerId` | Disponibilidade do cleaner |
| PUT | `/availability/:cleanerId/:date` | Atualizar disponibilidade |
| GET | `/route-suggestion` | Sugestão de rota entre apts |

---

## Rodando os testes

```bash
# Sobe o banco de teste
docker-compose up -d postgres_test

# Roda todos os testes
cd apps/backend
npm test

# Com coverage
npm test -- --coverage
```

> Os testes usam um banco PostgreSQL separado (`stay_test` na porta 5433) e são isolados por tenant.

---

## Variáveis de ambiente — referência completa

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | URL de conexão PostgreSQL |
| `JWT_SECRET` | ✅ | Segredo para assinar JWT (mín. 32 chars) |
| `AWS_ACCESS_KEY_ID` | Para uploads | Chave de acesso AWS |
| `AWS_SECRET_ACCESS_KEY` | Para uploads | Chave secreta AWS |
| `AWS_S3_BUCKET` | Para uploads | Nome do bucket S3 |
| `AWS_REGION` | Para uploads | Região AWS (ex: `us-east-1`) |
| `FIREBASE_PROJECT_ID` | Para push | ID do projeto Firebase |
| `FIREBASE_PRIVATE_KEY` | Para push | Chave privada da conta de serviço |
| `FIREBASE_CLIENT_EMAIL` | Para push | Email da conta de serviço |
| `ANTHROPIC_API_KEY` | Para OCR | Chave da API Anthropic |
| `N8N_WEBHOOK_URL` | Para WhatsApp | URL do webhook n8n |
| `ZAPI_TOKEN` | Para WhatsApp | Token da instância Z-API |
| `ZAPI_INSTANCE` | Para WhatsApp | ID da instância Z-API |
| `PORT` | Opcional | Porta do servidor (padrão: `3000`) |
| `NODE_ENV` | Opcional | `development` ou `production` |
