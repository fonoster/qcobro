# ctl

Command-Line for QCobro

[![Version](https://img.shields.io/npm/v/@qcobro/ctl.svg)](https://npmjs.org/package/@qcobro/ctl)
[![License](https://img.shields.io/npm/l/@qcobro/ctl.svg)](https://github.com/fonoster/qcobro/blob/main/package.json)

Use this tool to manage your QCobro resources from the command line, without going through
the operator console: sync a portfolio, create an agent template, or configure an MCP client
like Claude Desktop to use [`@qcobro/mcp`](../mcp).

It's built on [`@qcobro/sdk`](../sdk), so every command talks to the same QCobro API the SDK
and the console use, with the same client-side input validation.

## Setup

Link a workspace before running any authenticated command. You'll need a workspace API key
(an `accessKeyId` + `accessKeySecret`) — create one from the QCobro console's API Keys page —
and the `accessKeyId` of the workspace that key acts in.

```sh-session
$ qcobro workspaces:login
```

<!-- toc -->

- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g @qcobro/ctl
$ qcobro COMMAND
running command...
$ qcobro (--version)
@qcobro/ctl/1.24.1 darwin-arm64 node-v22.17.0
$ qcobro --help [COMMAND]
USAGE
  $ qcobro COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`qcobro agents:create`](#qcobro-agentscreate)
- [`qcobro agents:eval TEMPLATEID`](#qcobro-agentseval-templateid)
- [`qcobro mcp:configure`](#qcobro-mcpconfigure)
- [`qcobro portfolios:get ID`](#qcobro-portfoliosget-id)
- [`qcobro portfolios:list`](#qcobro-portfolioslist)
- [`qcobro portfolios:sync`](#qcobro-portfoliossync)
- [`qcobro workspaces:active`](#qcobro-workspacesactive)
- [`qcobro workspaces:list`](#qcobro-workspaceslist)
- [`qcobro workspaces:login`](#qcobro-workspaceslogin)
- [`qcobro workspaces:logout WORKSPACEACCESSKEYID`](#qcobro-workspaceslogout-workspaceaccesskeyid)
- [`qcobro workspaces:use WORKSPACEACCESSKEYID`](#qcobro-workspacesuse-workspaceaccesskeyid)

## `qcobro agents:create`

create an agent template in the active workspace

```
USAGE
  $ qcobro agents:create --type VOICE_AI|VOICE_PRERECORDED|SMS|EMAIL|WHATSAPP --name <value> [--voice <value>]
    [--language <value>] [--system-prompt <value>] [--first-message <value>] [--script <value>] [--fonoster-app-name
    <value>] [--message-body <value>] [--sender-id <value>] [--subject <value>] [--max-replies <value>] [--template-name
    <value>]

FLAGS
  --first-message=<value>      opening line (VOICE_AI, optional)
  --fonoster-app-name=<value>  Fonoster application name (voice types)
  --language=<value>           language code (voice channel types)
  --max-replies=<value>        reply cap per gestión (EMAIL, WHATSAPP)
  --message-body=<value>       message text (SMS, EMAIL)
  --name=<value>               (required) template name
  --script=<value>             full TTS script (VOICE_PRERECORDED)
  --sender-id=<value>          sender identifier (SMS, optional)
  --subject=<value>            email subject (EMAIL)
  --system-prompt=<value>      AI persona/instructions (VOICE_AI, EMAIL, WHATSAPP)
  --template-name=<value>      Meta template name (WHATSAPP)
  --type=<option>              (required) agent channel type
                               <options: VOICE_AI|VOICE_PRERECORDED|SMS|EMAIL|WHATSAPP>
  --voice=<value>              voice identifier (voice channel types)

DESCRIPTION
  create an agent template in the active workspace

EXAMPLES
  $ qcobro agents:create --type VOICE_AI --name "Cobranza suave" --voice sofia --system-prompt "Sé amable y directo." --language es

  $ qcobro agents:create --type SMS --name "Recordatorio" --message-body "Hola {{firstName}}, tienes un saldo pendiente."
```

## `qcobro agents:eval TEMPLATEID`

re-attempt an agent template's Fonoster sync and report the resulting status. This validates the template's configuration and its sync with Fonoster — QCobro has no conversational-intelligence evaluation feature today, so this does not test conversation behavior. Only VOICE_AI templates sync with Fonoster; other channel types are a no-op that leaves the template unchanged.

```
USAGE
  $ qcobro agents:eval TEMPLATEID

ARGUMENTS
  TEMPLATEID  the agent template id

DESCRIPTION
  re-attempt an agent template's Fonoster sync and report the resulting status. This validates the template's
  configuration and its sync with Fonoster — QCobro has no conversational-intelligence evaluation feature today, so this
  does not test conversation behavior. Only VOICE_AI templates sync with Fonoster; other channel types are a no-op that
  leaves the template unchanged.

EXAMPLES
  $ qcobro agents:eval <templateId>
```

## `qcobro mcp:configure`

configure an MCP client to use @qcobro/mcp

```
USAGE
  $ qcobro mcp:configure [-c claude] [--url <value>] [--access-key-id <value>] [--access-key-secret <value>]
    [--workspace <value>]

FLAGS
  -c, --client=<option>            [default: claude] MCP client to configure
                                   <options: claude>
      --access-key-id=<value>      workspace API key id (overrides active workspace)
      --access-key-secret=<value>  workspace API key secret (overrides active workspace)
      --url=<value>                [default: https://api.qcobro.com] QCobro API base URL
      --workspace=<value>          workspace to act in, its accessKeyId (overrides active workspace)

DESCRIPTION
  configure an MCP client to use @qcobro/mcp

EXAMPLES
  $ qcobro mcp:configure

  $ qcobro mcp:configure --client claude

  $ qcobro mcp:configure --access-key-id <id> --access-key-secret <secret> --workspace <workspaceAccessKeyId>
```

## `qcobro portfolios:get ID`

display a single portfolio

```
USAGE
  $ qcobro portfolios:get ID

ARGUMENTS
  ID  the portfolio id

DESCRIPTION
  display a single portfolio

EXAMPLES
  $ qcobro portfolios:get <id>
```

## `qcobro portfolios:list`

display the active workspace's portfolios

```
USAGE
  $ qcobro portfolios:list [--include-archived]

FLAGS
  --include-archived  include archived portfolios

DESCRIPTION
  display the active workspace's portfolios

EXAMPLES
  $ qcobro portfolios:list

  $ qcobro portfolios:list --include-archived
```

## `qcobro portfolios:sync`

synchronize a batch of account rows into a portfolio, from a JSON file

```
USAGE
  $ qcobro portfolios:sync --portfolio-id <value> --file <value> [--mode APPEND_ONLY|UPDATE_EXISTING|REPLACE]

FLAGS
  --file=<value>          (required) path to a JSON file containing an array of account rows
  --mode=<option>         [default: APPEND_ONLY] merge strategy
                          <options: APPEND_ONLY|UPDATE_EXISTING|REPLACE>
  --portfolio-id=<value>  (required) the portfolio id

DESCRIPTION
  synchronize a batch of account rows into a portfolio, from a JSON file

EXAMPLES
  $ qcobro portfolios:sync --portfolio-id <id> --file rows.json --mode APPEND_ONLY
```

## `qcobro workspaces:active`

display the active QCobro workspace

```
USAGE
  $ qcobro workspaces:active

DESCRIPTION
  display the active QCobro workspace

EXAMPLES
  $ qcobro workspaces:active
```

## `qcobro workspaces:list`

display all linked QCobro workspaces

```
USAGE
  $ qcobro workspaces:list

DESCRIPTION
  display all linked QCobro workspaces

EXAMPLES
  $ qcobro workspaces:list
```

## `qcobro workspaces:login`

link a QCobro workspace to the local environment

```
USAGE
  $ qcobro workspaces:login

DESCRIPTION
  link a QCobro workspace to the local environment

EXAMPLES
  $ qcobro workspaces:login
```

## `qcobro workspaces:logout WORKSPACEACCESSKEYID`

unlink a QCobro workspace from the local environment

```
USAGE
  $ qcobro workspaces:logout WORKSPACEACCESSKEYID

ARGUMENTS
  WORKSPACEACCESSKEYID  the workspace to unlink (its accessKeyId)

DESCRIPTION
  unlink a QCobro workspace from the local environment

EXAMPLES
  $ qcobro workspaces:logout WO6ueex0qan9ojhf820wgiae3qi5luy08y
```

## `qcobro workspaces:use WORKSPACEACCESSKEYID`

set a linked workspace as the active one

```
USAGE
  $ qcobro workspaces:use WORKSPACEACCESSKEYID

ARGUMENTS
  WORKSPACEACCESSKEYID  the workspace to activate (its accessKeyId)

DESCRIPTION
  set a linked workspace as the active one

EXAMPLES
  $ qcobro workspaces:use WO6ueex0qan9ojhf820wgiae3qi5luy08y
```

<!-- commandsstop -->
