/* eslint no-console: 0 */

const log = require('./log')
    , config = require('./config')
    , esprima = require('esprima')
    , astring = require('astring')

const jail = '__jail'
    , blocks = new Set(['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression'])

module.exports = function(code) {
  if (!config.jail)
    return code

  const start = Date.now()
  let ast

  try {
    ast = esprima.parse(code)
  } catch (e) {
    if (e.lineNumber >= 0) {
      e.indexContent = code[e.index]
      e.lineContent = code.split('\n')[e.lineNumber]
    }

    console.log('')
    log.error('Error jailing:')
    log.error(e.message)
    log.error(e.lineContent)
    log.error('Column: ' + e.index + '\n')
    return
  }

  run(ast)

  const compiled = astring(ast)

  log.debug('Jailing took', Date.now() - start + 'ms')

  return compiled
}

function run(ast) {
  if (ast && ast.id && ast.id.name === jail)
    return

  if (!ast || !ast.body)
    return

  (Array.isArray(ast.body) ? ast.body : [ast.body]).forEach(o => {
    if (o.type === 'IfStatement')
      return run(o.consequent)

    if (o.type === 'ExpressionStatement') {
      if (o.expression.callee)
        run(o.expression.callee.body)
      if (o.expression.right)
        run(o.expression.right.body)

      if (o.expression.arguments) {
        o.expression.arguments.forEach(a => {
          if (a.type === 'ObjectExpression')
            return properties(a.properties)
          if (a.type === 'ArrayExpression')
            return elements(a.elements)
          if (blocks.has(a.type))
            return run(a.body)
        })
      }

      return
    }

    if (blocks.has(o.type))
      return run(o.body)
  })

  if (ast.type === 'BlockStatement')
    fakeVariablesInBlock(ast.body)

}

function fakeVariablesInBlock(block) {
  const faker = makeFaker(getVariableNames(block))

  if (faker)
    block.push(faker)
}

function getVariableNames(body) {
  const names = []

  body.forEach(o => {
    if (o.type === 'FunctionDeclaration') {
      names.push(o.id.name)
    } else if (o.type === 'VariableDeclaration') {
      o.declarations.forEach(d => {
        names.push(d.id.name)

        if (d.init && d.init.type === 'ObjectExpression')
          properties(d.init.properties)
      })
    }
  })

  return names
}

function properties(p) {
  p.forEach(p => {
    if (p.value && p.value.type === 'ArrayExpression')
      return p.value.elements.forEach(e => blocks.has(e.type) && run(e.body))

    if (p.value && blocks.has(p.value.type))
      return run(p.value.body)
  })
}

function elements(p) {
  p.forEach(p => {
    if (p.type === 'ArrayExpression')
      return p.elements.forEach(e => blocks.has(e.type) && run(e.body))

    if (blocks.has(p.type))
      return run(p.body)
  })
}

function makeFaker(names) {
  if (names.length === 0)
    return

  return {
    type: 'FunctionDeclaration',
    id: {
      type: 'Identifier',
      name: jail
    },
    params: [],
    defaults: [],
    body: {
      type: 'BlockStatement',
      body: [{
        type: 'ExpressionStatement',
        expression: {
          type: 'SequenceExpression',
          expressions: names.map(n => ({ type: 'Identifier', name: n }))
        }
      }]
    }
  }
}
