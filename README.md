# rabbithole

<p align="center">
  <img src="https://preview.redd.it/is-there-a-high-quality-image-of-the-white-rabbit-tattoo-v0-upaelxivgzye1.jpeg?width=1024&format=pjpg&auto=webp&s=31da5b1ef9ac8674c85b26e4d295aea50c667502" alt="Follow the White Rabbit" width="100%" />
</p>

```
Wake up, Developer...
The Matrix has you...
Follow the white rabbit.
```

> _"You take the blue pill — you run `npm audit`, the story ends, you wake up in your bed and believe whatever the terminal tells you. You take the red pill — you run `rabbithole`, you stay in Wonderland, and I show you how deep the dependency tree goes."_
>
> — Morpheus, probably

---

## What is this?

**rabbithole** is a dependency health check CLI. It shows you the truth about your project's dependencies — the vulnerabilities you didn't know about, the outdated packages you've been ignoring, the deprecated ones silently rotting, and the stale ones nobody maintains anymore.

`npm audit` is the blue pill. `rabbithole` is the red pill.

## Install

```bash
npm install -g rabbithole
```

Or clone the source and unplug from the Matrix yourself:

```bash
git clone <repo>
cd rabbithole
npm install
npm run build
npm link
```

## Usage

### `rabbithole scan`

_"I know kung fu."_ — No. But now you know exactly what's wrong with your deps.

Scan your project for vulnerabilities, outdated, deprecated, and stale packages:

```bash
rabbithole scan
```

```
  rabbithole scan

  Summary

  ● 3 vulnerabilities (1 critical, 2 high)
  ● 12 outdated packages
  ● 2 deprecated packages
  ● 4 stale packages (no update in 2+ years)

  Vulnerabilities

  ┌──────────┬──────────────┬─────────────────────┬──────────────┐
  │ Severity │ Package      │ Title               │ Fix Available│
  ├──────────┼──────────────┼─────────────────────┼──────────────┤
  │ CRITICAL │ lodash       │ Prototype Pollution │ 4.17.21      │
  └──────────┴──────────────┴─────────────────────┴──────────────┘

  Outdated Packages

  ┌──────────────┬─────────┬─────────┬──────┐
  │ Package      │ Current │ Latest  │ Type │
  ├──────────────┼─────────┼─────────┼──────┤
  │ express      │ 4.18.0  │ 5.0.0   │ prod │
  └──────────────┴─────────┴─────────┴──────┘
```

### `rabbithole update`

_"There is no spoon."_ — And there are no safe outdated dependencies. Fix them.

Interactive mode (select which packages to update):

```bash
rabbithole update
```

Update specific packages:

```bash
rabbithole update lodash express
```

Update all outdated packages at once:

```bash
rabbithole update --all
```

### Options

| Flag          | Description                            | Default |
| ------------- | -------------------------------------- | ------- |
| `--exact`     | Save exact versions (no caret/tilde)   | `true`  |
| `--no-exact`  | Save with caret range (standard npm)   | -       |
| `-a, --all`   | Update all outdated packages at once   | `false` |
| `-f, --force` | Force install, ignoring peer conflicts | `false` |

## How it works

_"The Matrix is everywhere. It is all around us."_ — So are your dependencies.

Behind the curtain, **rabbithole** pulls data from multiple sources and combines them into a single, clean report:

| Agent               | Mission                                   | Source                               |
| ------------------- | ----------------------------------------- | ------------------------------------ |
| **Vulnerabilities** | Find known security threats               | `npm audit --json`                   |
| **Outdated**        | Detect packages behind latest version     | `npm outdated --json`                |
| **Deprecated**      | Flag packages marked as deprecated        | npm registry API                     |
| **Stale**           | Catch packages with no update in 2+ years | npm registry API (last publish date) |

No noise. No walls of text. Just the truth.

## The Lore

You know that feeling when you run `npm audit` and it spits out 847 lines of incomprehensible garbage? That's the Matrix. It's designed to keep you asleep, scrolling through meaningless walls of text, never really understanding what's wrong.

**rabbithole** is your red pill.

It follows the white rabbit down your `node_modules`, dives deep into the dependency tree, and comes back with a clean report. No junk. No "fix available via `npm audit fix --force`" that breaks everything. Just a clear view of what needs your attention.

_"I didn't say it would be easy, Neo. I only said it would be the truth."_

## The Matrix Glossary

| Matrix Term          | In rabbithole                                            |
| -------------------- | -------------------------------------------------------- |
| The Matrix           | Your `node_modules` — looks fine, but it's a lie         |
| The Red Pill         | Running `rabbithole scan` for the first time             |
| Agents               | Vulnerabilities lurking in your deps                     |
| Glitch in the Matrix | A deprecated package still in production                 |
| The Oracle           | The scan report — it knows all                           |
| Zion                 | A project with zero issues. The promised land.           |
| The Architect        | You, after fixing everything                             |
| "There is no spoon"  | "There are no safe outdated deps"                        |
| Déjà vu              | That feeling when you see the same vuln in every project |

## Contributing

_"I can only show you the door. You're the one that has to walk through it."_

PRs welcome. Open an issue, fork the repo, and follow the white rabbit.

## License

MIT

---

```
       Wake up...
  Your dependencies need you.

         (\(\
         ( -.-) Follow me.
         o_(")(")

      $ rabbithole scan
```
