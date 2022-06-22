'use strict'

const { resolve } = require('path')
const Arborist = require('@npmcli/arborist')
const BaseCommand = require('../base-command.js')

class QuerySelectorItem {
  constructor (node) {
    Object.assign(this, node.target.package)

    // append extra info
    this.pkgid = node.target.pkgid
    this.location = node.target.location
    this.path = node.target.path
    this.realpath = node.target.realpath
    this.resolved = node.target.resolved
    this.isLink = node.target.isLink
    this.isWorkspace = node.target.isWorkspace
  }
}

// retrieves a normalized inventory
const convertInventoryItemsToResponses = inventory => {
  const responses = []
  const responsesSeen = new Set()
  for (const node of inventory) {
    if (!responsesSeen.has(node.target.realpath)) {
      const item = new QuerySelectorItem(node)
      responses.push(item)
      responsesSeen.add(item.path)
    }
  }
  return responses
}

class Query extends BaseCommand {
  static description = 'Retrieve a filtered list of packages'
  static name = 'query'
  static usage = ['<selector>']

  static ignoreImplicitWorkspace = false

  static params = [
    'global',
    'workspace',
    'workspaces',
    'include-workspace-root',
  ]

  async exec (args, workspaces) {
    // one dir up from wherever node_modules lives
    const where = resolve(this.npm.dir, '..')
    const opts = {
      ...this.npm.flatOptions,
      path: where,
    }
    const arb = new Arborist(opts)
    const tree = await arb.loadActual(opts)
    const items = await tree.querySelectorAll(args[0])
    const res = convertInventoryItemsToResponses(items)

    this.npm.output(JSON.stringify(res, null, 2))
  }

  async execWorkspaces (args, filters) {
    await this.setWorkspaces(filters)
    const result = new Set()
    const opts = {
      ...this.npm.flatOptions,
      path: this.npm.prefix,
    }
    const arb = new Arborist(opts)
    const tree = await arb.loadActual(opts)
    for (const workspacePath of this.workspacePaths) {
      const [workspace] = await tree.querySelectorAll(`.workspace:path(${workspacePath})`)
      const res = await workspace.querySelectorAll(args[0])
      const converted = convertInventoryItemsToResponses(res)
      for (const item of converted) {
        result.add(item)
      }
    }
    // when running in workspaces names, make sure to key by workspace
    // name the results of each value retrieved in each ws
    this.npm.output(JSON.stringify([...result], null, 2))
  }
}

module.exports = Query
