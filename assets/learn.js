/* ============================================================
 * learn.js — OpenCode 培训资料（自学用）
 * 内容均为静态教程文本，渲染进 AI 版块的「培训资料」面板。
 * 资料基于 opencode.ai 官方文档与社区整理，仅供参考学习。
 * ========================================================== */
(function (global) {
  'use strict';

  const LEARN = {
    updated: '2026-07',
    sections: [
      {
        title: '什么是 OpenCode',
        body: `
<p><b>OpenCode</b> 是一个<strong>开源</strong>的终端 AI 编程 Agent，由 SST 团队（Serverless Stack 的开发者）打造，MIT 许可证。你可以在<strong>终端、桌面应用、IDE 扩展</strong>里用它写代码、调试、重构、管理 Git。</p>
<p>它常被称作 <strong>Claude Code 的开源替代品</strong>：能力相近，但不绑定任何模型厂商。</p>
<ul>
  <li><b>开源</b>：MIT 许可证，代码完全公开</li>
  <li><b>多模型</b>：通过 Vercel AI SDK 支持 75+ 供应商（Claude、GPT、Gemini、Bedrock、Ollama 本地模型等）</li>
  <li><b>隐私优先</b>：不存储你的代码或上下文，可在敏感环境使用</li>
  <li><b>客户端/服务端分离</b>：TUI 只是前端之一，服务端可被远程/手机驱动</li>
</ul>`,
      },
      {
        title: '核心特性一览',
        body: `
<ul>
  <li><b>双 Agent 模式</b>：<code>build</code>（默认，可改文件）与 <code>plan</code>（只读分析，需审批）</li>
  <li><b>LSP 集成</b>：自动加载对应语言的 LSP，做语言感知的代码理解（这是相比 Claude Code 的差异化能力）</li>
  <li><b>MCP 支持</b>：Model Context Protocol，接入外部工具/服务</li>
  <li><b>多会话并行</b>：同一项目可同时跑多个 Agent，互不冲突</li>
  <li><b>子代理</b>：<code>@general</code>（多步研究）、<code>@explore</code>（只读探索代码库）</li>
  <li><b>/init</b>：分析项目并生成 <code>AGENTS.md</code>，让 Agent 理解你的项目</li>
  <li><b>撤销/重做</b>：<code>/undo</code> <code>/redo</code>，会话可分享链接</li>
  <li><b>桌面应用</b>：macOS / Windows / Linux（Beta）</li>
</ul>`,
      },
      {
        title: '安装（6 种方式）',
        body: `
<p>最简单是官方一键脚本；也可以按需选择包管理器。</p>
<pre><code># 方式一：官方安装脚本（推荐）
curl -fsSL https://opencode.ai/install | bash

# 方式二：Node 系
npm install -g opencode-ai
bun install -g opencode-ai
pnpm install -g opencode-ai

# 方式三：Homebrew（macOS / Linux）
brew install anomalyco/tap/opencode

# 方式四：Arch Linux
sudo pacman -S opencode          # 稳定版
paru -S opencode-bin             # AUR 最新版

# 方式五：Windows
choco install opencode
scoop install opencode

# 方式六：Docker
docker run -it --rm ghcr.io/anomalyco/opencode</code></pre>
<p>Windows 用户官方建议用 WSL，兼容性与性能最好。验证：<code>opencode --version</code></p>`,
      },
      {
        title: '5 分钟快速上手',
        body: `
<ol>
  <li>装好后进入项目目录：<code>cd ~/projects/my-app</code></li>
  <li>运行 <code>opencode</code> 启动终端界面</li>
  <li>配置供应商：在 TUI 里执行 <code>/connect</code>，按提示登录或粘贴 API Key（推荐用 <b>OpenCode Zen</b> 精选模型）</li>
  <li>选择模型：<code>/models</code> 选要用的模型</li>
  <li>初始化项目：<code>/init</code> 让它分析项目并生成 <code>AGENTS.md</code></li>
  <li>开始对话：直接描述需求，例如「检查 src/auth.py 的登录逻辑有没有安全问题」</li>
</ol>`,
      },
      {
        title: '常用命令速查表',
        body: `
<table class="cmd">
<tr><td><code>/new</code></td><td>新建会话（别名 <code>/clear</code>）</td></tr>
<tr><td><code>/session</code></td><td>列出并切换会话</td></tr>
<tr><td><code>/compact</code></td><td>压缩当前会话上下文（别名 <code>/summarize</code>）</td></tr>
<tr><td><code>/undo</code> / <code>/redo</code></td><td>撤销 / 重做上一条消息</td></tr>
<tr><td><code>/models</code></td><td>选择模型</td></tr>
<tr><td><code>/connect</code></td><td>连接 / 添加供应商凭据</td></tr>
<tr><td><code>/init</code></td><td>分析项目，生成 AGENTS.md</td></tr>
<tr><td><code>/editor</code></td><td>用外部编辑器（<code>$EDITOR</code>）写长消息</td></tr>
</table>
<p>非交互模式也可直接用：<code>opencode "解释这个函数" --file src/utils.ts</code></p>`,
      },
      {
        title: 'Plan 模式 vs Build 模式',
        body: `
<p>OpenCode 有两种主模式，用 <b>Tab 键</b>切换（右下角有指示）。</p>
<ul>
  <li><b>🧠 Plan 模式（只读）</b>：不能改代码，只分析、探索、给出实现方案。适合动手前先想清楚。</li>
  <li><b>🔨 Build 模式（默认）</b>：可读写文件、执行命令，真正改代码。</li>
</ul>
<p><b>最佳实践</b>：复杂功能先切到 Plan 出方案，和你确认后再切回 Build 实施——能避免代价高昂的误操作。</p>`
      },
      {
        title: '配置文件 opencode.json',
        body: `
<p>模型 ID 格式为 <code>provider_id/model_id</code>。全局配置在 <code>~/.config/opencode/opencode.json</code>，项目级在 <code>./opencode.json</code>。</p>
<pre><code>{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": { "models": { "anthropic/claude-sonnet-4": {} } },
    "openai":    { "models": { "openai/gpt-4o": {} } },
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": { "baseURL": "http://localhost:11434/v1" },
      "models": { "qwen2.5-coder:32b": {} }
    }
  },
  "model": "anthropic/claude-sonnet-4",
  "small_model": "anthropic/claude-haiku-3-5",
  "model": {
    "anthropic/claude-sonnet-4": {
      "variants": { "fast": { "temperature": 0.3 }, "creative": { "temperature": 0.9 } }
    }
  }
}</code></pre>
<ul>
  <li><code>small_model</code>：标题生成等轻量任务自动用更便宜的模型</li>
  <li><code>variants</code>：同一模型定义不同参数，无需重复条目</li>
  <li>运行时也可用 <code>/model openai</code> 临时切换</li>
</ul>`,
      },
      {
        title: 'MCP 集成',
        body: `
<p>OpenCode 支持 Model Context Protocol，可接入外部工具。在 <code>opencode.json</code> 里声明：</p>
<pre><code>{
  "mcp": {
    "servers": {
      "my-server": {
        "type": "stdio",
        "command": "node",
        "args": ["./mcp-server.js"]
      }
    }
  }
}</code></pre>
<p>支持 <code>stdio</code> 与 <code>sse</code> 两种传输方式，可把数据库、内部 API、文档系统等变成 Agent 能调用的工具。</p>`,
      },
      {
        title: '高效工作流技巧',
        body: `
<ul>
  <li><b>先 Plan 再 Build</b>：把 Agent 当初级工程师，给足上下文和细节</li>
  <li><b>写好 AGENTS.md</b>：技术栈、目录结构、编码规范、约定都写进去</li>
  <li><b>图片直接拖进终端</b>：OpenCode 能读取图片并加入提示词（如参考设计稿）</li>
  <li><b>用子代理探索</b>：<code>@explore</code> 只读扫描陌生代码库，<code>@general</code> 做多步调研</li>
  <li><b>多会话并行</b>：不同任务开不同会话，互不干扰</li>
  <li><b>定期 /compact</b>：长会话压缩上下文，省 token、保连贯</li>
</ul>`,
      },
      {
        title: '快捷键',
        body: `
<table class="cmd">
<tr><td><code>Tab</code></td><td>切换 Plan / Build 模式</td></tr>
<tr><td><code>Ctrl/⌘ + P</code></td><td>命令面板（类 VS Code）</td></tr>
<tr><td><code>Ctrl/⌘ + Esc</code></td><td>在 IDE 分屏中打开（VS Code / Cursor）</td></tr>
<tr><td><code>/undo</code> <code>/redo</code></td><td>撤销 / 重做</td></tr>
</table>
<p>内置 Vim 风格编辑器写长提示；主题系统有 62 个可配颜色属性，支持亮/暗。</p>`,
      },
      {
        title: 'OpenCode vs Claude Code',
        body: `
<table class="cmd">
<tr><th>维度</th><th>OpenCode</th><th>Claude Code</th></tr>
<tr><td>开源</td><td>✅ MIT</td><td>❌ 闭源</td></tr>
<tr><td>模型</td><td>75+ 供应商</td><td>仅 Anthropic</td></tr>
<tr><td>架构</td><td>客户端/服务端（可远程驱动）</td><td>本地封闭</td></tr>
<tr><td>LSP</td><td>✅ 内置</td><td>❌</td></tr>
<tr><td>桌面应用</td><td>✅（Beta）</td><td>❌</td></tr>
<tr><td>自定义 Agent</td><td>Markdown / JSON 配置</td><td>CLAUDE.md 约定</td></tr>
</table>
<p class="muted">注：2026 年 1 月 Anthropic 曾限制第三方工具使用 Claude 模型，此后 OpenCode 用户多用 GPT / Gemini / 本地模型。选工具看你的合规与模型偏好。</p>`,
      },
      {
        title: '推荐学习路径',
        body: `
<ol>
  <li><b>第 1 天</b>：装好 OpenCode，<code>/connect</code> 接一个模型，跑通「解释一段代码」</li>
  <li><b>第 2 天</b>：在一个小项目里用 <code>/init</code> 生成 AGENTS.md，试着加一个小功能（先 Plan 后 Build）</li>
  <li><b>第 3 天</b>：练习 <code>/undo</code> <code>/compact</code> <code>/session</code>，体会会话管理</li>
  <li><b>第 4 天</b>：配置 <code>opencode.json</code> 多模型，学会运行时切换</li>
  <li><b>进阶</b>：接一个 MCP 服务、写自定义 Agent、用子代理做代码库调研</li>
</ol>`,
      },
      {
        title: '常见问题 FAQ',
        body: `
<ul>
  <li><b>要付费吗？</b> OpenCode 本身免费开源，只需付模型 API 费用；用 Ollama 本地模型可零成本。</li>
  <li><b>必须订阅 Claude 吗？</b> 不必，任意供应商都行，也可用 OpenCode Zen 精选模型。</li>
  <li><b>只能在终端用？</b> 不，还有桌面应用与 IDE 扩展。</li>
  <li><b>数据安全？</b> 不存储你的代码/上下文；本地模型则数据不出本机。</li>
  <li><b>和 Claude Code 怎么选？</b> 想灵活、开源、不锁定厂商 → OpenCode；深度绑定 Anthropic 生态 → Claude Code。</li>
</ul>`,
      },
      {
        title: '动手实战：用 OpenCode 从零搭一个小项目',
        body: `
<p>把前面学的串起来，完整走一遍：用 OpenCode 在一个空目录里造一个<strong>命令行待办工具</strong>（Node.js，零第三方依赖）。</p>
<h4>① 初始化项目</h4>
<pre><code>mkdir todo-cli && cd todo-cli
opencode           # 启动终端界面
/init              # 让 Agent 生成 AGENTS.md，让它理解这是个空项目</code></pre>
<h4>② Plan 先想清楚</h4>
<p>按 <code>Tab</code> 切到 Plan 模式，描述需求（只读，不写文件）：</p>
<pre><code>做一个命令行待办工具：
- 命令：add / list / done / rm
- 数据存到本地 todos.json
- 只用 Node 内置模块，不要第三方依赖
先给我实现方案，不要改文件。</code></pre>
<p>Agent 会列出文件结构、每条命令的逻辑，确认无误后再动手。</p>
<h4>③ Build 落地</h4>
<p>切回 Build 模式说「按方案实现」，Agent 会创建 <code>index.js</code> 并写入代码，过程中自己跑 <code>node index.js add "买牛奶"</code> 验证。</p>
<h4>④ 自测与修复</h4>
<pre><code>node index.js list        # 看是否列出
node index.js done 1      # 标记完成
# 发现中文在终端乱码？让 Agent 用 writeFile 指定 utf8 编码</code></pre>
<h4>⑤ 提交</h4>
<pre><code>/undo            # 撤销上一条不满意的改动（如有）
git init && git add . && git commit -m "feat: todo-cli MVP"</code></pre>
      <p class="muted">关键心法：复杂任务永远「先 Plan 对齐，再 Build 实施」，把 Agent 当作需要清晰指令的初级工程师；长会话多用 <code>/compact</code> 控制上下文长度，省钱也更连贯。</p>`,
      },
      {
        title: '动手实战：接入一个真实 MCP（以文件系统为例）',
        body: `
<p>MCP（Model Context Protocol）让 Agent 能调用外部工具。最实用的入门实战，是给它接一个<strong>文件系统</strong> MCP，让它能读/写你指定的目录——相当于把本地文件夹变成 Agent 可用的工具。</p>
<h4>① 准备</h4>
<p>需要 Node.js（≥18）。挑一个你愿意暴露给 Agent 的目录，例如 <code>~/notes</code>（只暴露这个目录，Agent 访问不到别的）。</p>
<h4>② 在 opencode.json 里声明</h4>
<pre><code>{
  "mcp": {
    "servers": {
      "filesystem": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/ABS/PATH/TO/notes"]
      }
    }
  }
}</code></pre>
<p>把 <code>/ABS/PATH/TO/notes</code> 换成真实绝对路径。stdio 方式会随 OpenCode 启动这个服务进程。</p>
<h4>③ 验证连接</h4>
<p>启动 <code>opencode</code> 后执行：</p>
<pre><code>/mcp            # 列出已连接的 MCP 服务，应看到 filesystem 及其提供的工具</code></pre>
<h4>④ 真正用起来</h4>
<p>直接对 Agent 说：</p>
<pre><code>读取 ~/notes/todo.md，总结里面的待办并告诉我还差几项</code></pre>
<p>Agent 会调用 filesystem 工具去读文件并返回结果。也能让它“在 ~/notes 下新建 today.md，写下今天的 3 件事”。</p>
<h4>⑤ 安全与更多</h4>
<ul>
  <li><b>最小暴露</b>：只把必要的目录加进 args，别暴露整个 home，避免误删。</li>
  <li><b>常用 MCP</b>：<code>@modelcontextprotocol/server-github</code>（仓库操作）、<code>server-sqlite</code>（本地数据库）、<code>server-fetch</code>（抓取网页）、<code>brave-search</code>（联网搜索）。</li>
  <li><b>传输方式</b>：本地多用 <code>stdio</code>；远程服务用 <code>sse</code>。</li>
</ul>
<p class="muted">这是纯本地实操：MCP 服务跑在你机器上，文件不出本机，和 LifeHub「数据留本地」的思路一致。</p>`,
      },
    ],
  };

  global.LEARN = LEARN;
})(window);
