import {prettyDOM} from './pretty-dom'
import {fuzzyMatches, matches, makeNormalizer} from './matches'
import {waitForElement} from './wait-for-element'

/* eslint-disable complexity */
function debugDOM(htmlElement) {
  const limit = process.env.DEBUG_PRINT_LIMIT || 7000
  const inNode =
    typeof process !== 'undefined' &&
    process.versions !== undefined &&
    process.versions.node !== undefined
  /* istanbul ignore next */
  const window =
    (htmlElement.ownerDocument && htmlElement.ownerDocument.defaultView) ||
    undefined
  const inCypress =
    (typeof global !== 'undefined' && global.Cypress) ||
    (typeof window !== 'undefined' && window.Cypress)
  /* istanbul ignore else */
  if (inCypress) {
    return ''
  } else if (inNode) {
    return prettyDOM(htmlElement, limit)
  } else {
    return prettyDOM(htmlElement, limit, {highlight: false})
  }
}
/* eslint-enable complexity */

function getElementError(message, container) {
  return new Error([message, debugDOM(container)].filter(Boolean).join('\n\n'))
}

function getMultipleElementsFoundError(message, container) {
  return getElementError(
    `${message}\n\n(If this is intentional, then use the \`*AllBy*\` variant of the query (like \`queryAllByText\`, \`getAllByText\`, or \`findAllByText\`)).`,
    container,
  )
}

function queryAllByAttribute(
  attribute,
  container,
  text,
  {exact = true, collapseWhitespace, trim, normalizer} = {},
) {
  const matcher = exact ? matches : fuzzyMatches
  const matchNormalizer = makeNormalizer({collapseWhitespace, trim, normalizer})
  return Array.from(container.querySelectorAll(`[${attribute}]`)).filter(node =>
    matcher(node.getAttribute(attribute), node, text, matchNormalizer),
  )
}

function queryByAttribute(attribute, container, text, ...args) {
  const els = queryAllByAttribute(attribute, container, text, ...args)
  if (els.length > 1) {
    throw getMultipleElementsFoundError(
      `Found multiple elements by [${attribute}=${text}]`,
      container,
    )
  }
  return els[0] || null
}

// this accepts a query function and returns a function which throws an error
// if more than one elements is returned, otherwise it returns the first
// element or null
function makeSingleQuery(allQuery, getMultipleError) {
  return (container, ...args) => {
    const els = allQuery(container, ...args)
    if (els.length > 1) {
      throw getMultipleElementsFoundError(
        getMultipleError(container, ...args),
        container,
      )
    }
    return els[0] || null
  }
}

// this accepts a query function and returns a function which throws an error
// if an empty list of elements is returned
function makeGetAllQuery(allQuery, getMissingError) {
  return (container, ...args) => {
    const els = allQuery(container, ...args)
    if (!els.length) {
      throw getElementError(getMissingError(container, ...args), container)
    }
    return els
  }
}

// this accepts a getter query function and returns a function which calls
// waitForElement and passing a function which invokes the getter.
function makeFindQuery(getter) {
  return (container, text, options, waitForElementOptions) =>
    waitForElement(
      () => getter(container, text, options),
      waitForElementOptions,
    )
}

function buildQueries(queryAllBy, getMultipleError, getMissingError) {
  const queryBy = makeSingleQuery(queryAllBy, getMultipleError)
  const getAllBy = makeGetAllQuery(queryAllBy, getMissingError)
  const getBy = makeSingleQuery(getAllBy, getMultipleError)
  const findAllBy = makeFindQuery(getAllBy)
  const findBy = makeFindQuery(getBy)

  return [queryBy, getAllBy, getBy, findAllBy, findBy]
}

export {
  debugDOM,
  getElementError,
  getMultipleElementsFoundError,
  queryAllByAttribute,
  queryByAttribute,
  makeSingleQuery,
  makeGetAllQuery,
  makeFindQuery,
  buildQueries,
}
