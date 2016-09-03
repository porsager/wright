/* eslint no-console: 0 */

const esprima = require('esprima')
    , escodegen = require('escodegen')

const jail = '__jail'
    , blocks = new Set(['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression'])

module.exports = function(code) {
  const ast = esprima.parse(code)

  run(ast)

  const compiled = escodegen.generate(ast)

  return compiled
}

function run(ast) {
  if (ast && ast.id && ast.id.name === jail)
    return

  if (!ast || !ast.body)
    return

  ast.body.forEach(o => {
    if (o.type === 'IfStatement')
      return run(o.consequent)

    if (o.type === 'ExpressionStatement') {
      if (o.expression.callee)
        return run(o.expression.callee.body)
      if (o.expression.right)
        return run(o.expression.right.body)

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
    if (o.type === 'VariableDeclaration') {
      o.declarations.forEach(d => {
        names.push(d.id.name)

        if (d.init.type === 'ObjectExpression') {
          d.init.properties.forEach(p => {
            if (p.value.type === 'ArrayExpression')
              return p.value.elements.forEach(e => blocks.has(e.type) && run(e.body))

            if (blocks.has(p.value.type))
              return run(p.value.body)
          })
        }
      })
    }
  })

  return names
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
