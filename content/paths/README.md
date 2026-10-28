# Learning paths

The official learning paths, one YAML file each. Importing a file creates the path in the global catalog, or brings it
up to date: import it again after every change. Either way, you see what would change first:

- **Admin › Catalog › Import file**: choose the file; the dialog shows what importing it changes (or the file's
  problems), and **Import** makes the change. It's in the audit log.
- **`yarn cli catalog:import content/paths/<file>.yaml`**, with `--dry-run` to see what would change.

The same format works for anyone's own paths: **My paths › Import file** imports a file into your workspace (a private
path you're enrolled in) or an organization you run, with that catalog's own items. Official items aren't used or
changed.

A new path starts as a **draft**: check it in Admin › Catalog, then publish it there. Its modules, topics and items are
published already, so publishing the path shows all of it. Statuses that already exist are never changed by an import.

## The format

```yaml
slug: dsa                          # the path's address; never change it once published
title: Data Structures & Algorithms
description: What it covers and who it's for.
modules:
  - title: Arrays & Hashing
    slug: arrays-hashing            # optional: the title as a slug. Give one before renaming a title (see below)
    description: Optional, shown under the module.
    topics:
      - title: Hashing Basics
        description: The pattern, in a sentence or two (Markdown).
        items:
          - leetcode: two-sum       # a LeetCode problem: its slug from the URL
            title: Two Sum
            difficulty: easy        # easy, medium or hard
            minutes: 20             # an estimate
            tags: [arrays, hashing]
          - type: video             # problem, article, video, book, course, note or exercise
            title: Hash maps in 10 minutes
            url: https://...
            durationMinutes: 10
            optional: true          # extra material, not needed to complete the topic
          - type: note
            title: When to use a hash map
            content: |
              Markdown written by us.
```

Fields by type, besides `title`, `description`, `difficulty`, `minutes`, `tags` and `optional`:

| Type | Fields |
|---|---|
| `problem` | `url` (required), `platform`, or just `leetcode: <slug>` |
| `article` | `url` (required) |
| `video` | `url` (required), `durationMinutes` |
| `book` | `author`, `chapters`, `isbn`, `url` |
| `course` | `url` (required), `provider` |
| `note` | `content` (required, Markdown) |
| `exercise` | `instructions` (required, Markdown), `answer` |

## How changes are matched

- **Path, modules, topics** by slug. A module or topic whose title changes without a `slug` gets a new slug, so it's
  imported as a new one; give it `slug:` (its current slug) first. Modules and topics no longer in the file are kept
  (learners may follow them) and listed by the import: delete them in Admin if you mean to.
- **Items** by type and URL, or by type and title for notes and exercises. The same problem in two paths is one item,
  so learners' progress on it counts in both. Items no longer in a topic are taken out of it, not deleted.

## On production

Use **Import file** in Admin › Catalog. Or with kubectl: the file is read from stdin, so it doesn't need to be in the
image:

```bash
kubectl -n studylog exec -i deploy/api -c api -- node apps/cli/dist/main.js catalog:import - --dry-run < content/paths/dsa.yaml
kubectl -n studylog exec -i deploy/api -c api -- node apps/cli/dist/main.js catalog:import - < content/paths/dsa.yaml
```
