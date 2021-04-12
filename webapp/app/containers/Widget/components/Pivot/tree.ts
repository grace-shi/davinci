import Node from './node'
import cloneDeep from 'lodash/cloneDeep'
import { getOriginKey, isSumLastNode, isSumNodeEnd, isQuotaSum } from './util'
import { SumType, CategoryType, SumText } from './constants'
import { replaceRowColPrx } from './util'
export type TreeNodeLevelType = 'row' | 'col' | 'metrics'

export type TreeNodeSumType =
  | 'default'
  | 'colTotal'
  | 'rowTotal'
  | 'subTotal'
  | 'rowSubTotal'
  | 'colSubTotal'

interface ITreeNodeProperty {
  initKey: string
  key: string
  label: string
  levelCount: number
  levelType: TreeNodeLevelType
  listNumber: number
  originKey: string
  originParentKey: string
  parentKey: string
  samePathNode: any
  sumType: TreeNodeSumType
  sumLastNode: boolean
  sumNode: boolean
  children: Array<ITreeNodeProperty>
  parent: ITreeNodeProperty
}

class MultiwayTree {
  public tree = {
    wideProps: {
      root: null,
      wideTableList: [],
      metrics: [],
      metricsAgg: [],
      metricsTotal: {},
      colArray: [],
      rowArray: [],
      resultWideList: [],
      resultList: [],
      metricNodeList: [],
      rowColConcat: [],
      rowLast: null,
      colLast: null
    },
    labelText: {
      rootLevel: { name_level0_cols: 'root' },
      rootKey: ['name_level0_cols']
    },
    nodeProperty: {
      initKey: '',
      key: '',
      label: '',
      levelCount: 0,
      levelType: '',
      listNumber: 0,
      originKey: '',
      originParentKey: '',
      parentKey: '',
      samePathNode: {},
      sumType: '',
      sumLastNode: false,
      sumNode: false
    }
  }

  constructor() {}

  public getTraverseBF(callback) {
    const queue = []
    let found = false
    queue.push(this.tree.wideProps.root)
    let currentNode = queue.shift()

    while (!found && currentNode) {
      found = !!callback(currentNode)
      if (!found) {
        queue.push(...currentNode.children)
        currentNode = queue.shift()
      }
    }
    return found
  }

  public getContains(callback, traversal) {
    traversal.call(this, callback)
  }

  public getAddToData(obj, toData) {
    const metrics = this.tree.wideProps.metrics

    const node = new Node(obj)
    node.set(obj, metrics)
    if (this.tree.wideProps.root === null) {
      this.tree.wideProps.root = node
      return this
    }
    const exitCallBack = function (currentNode) {
      if (currentNode.key === node.key && currentNode.label === node.label) {
        return true
      }
    }
    const exitTag = tree.getTraverseBF.call(this, exitCallBack)
    if (exitTag) {
      return this
    }

    let parent = null
    const callback = (node) => {
      if (node.key === toData.key) {
        parent = node
        return true
      }
    }
    this.getContains(callback, tree.getTraverseBF)
    if (parent) {
      parent.children.push(node)
      node.parent = parent
      return this
    } else {
      throw new Error()
    }
  }

  private getParentId(treeNodeGroup) {
    const { listNumber, levelType, samePathNode } = this.tree.nodeProperty
    if (samePathNode) {
      return this.tree.nodeProperty.samePathNode.parentKey
    } else {
      if (levelType == CategoryType.Metrics) {
        return treeNodeGroup[treeNodeGroup.length - 1].key
      }
      if (!listNumber) {
        return this.tree.nodeProperty.originParentKey
      } else {
        return treeNodeGroup[treeNodeGroup.length - 1].key
      }
    }
  }
  // TODO refactor
  public getNodeLevelType(levelKey) {
    const isRow = [
      ...this.tree.wideProps.rowArray,
      ...this.tree.labelText.rootKey
    ].includes(levelKey)
    const isCol = this.tree.wideProps.colArray.includes(levelKey)
    let levelType
    if (isRow) {
      levelType = 'row'
    } else if (isCol) {
      levelType = 'col'
    } else {
      levelType = 'metrics'
    }
    return levelType
  }

  public getMultiwayTree() {
    this.tree.wideProps.wideTableList.forEach((listItem, listNumber) => {
      const treeNodeGroup = []
      const targetNodeGroup = []
      listItem = { ...this.tree.labelText.rootLevel, ...listItem }
      this.tree.nodeProperty.samePathNode = null
      Object.keys(listItem).forEach((levelKey, levelCount) => {
        const originParentKey = levelCount
          ? `${Object.keys(listItem)[levelCount - 1]}_${listNumber}`
          : null
        const initKey = `${levelKey}_${listNumber}`
        const label = this.tree.wideProps.metrics.includes(levelKey)
          ? levelKey
          : listItem[levelKey]
        const levelType = tree.getNodeLevelType(levelKey)
        this.tree.nodeProperty = {
          originParentKey,
          listNumber,
          levelCount,
          initKey,
          label,
          levelType
        }
        if (!listNumber) {
          this.tree.nodeProperty.samePathNode = null
        } else if (!levelCount) {
          this.tree.nodeProperty.samePathNode = this.tree.wideProps.root
        } else {
          const queue = [this.tree.wideProps.root]
          let currentNode = queue[0]
          while (levelCount !== currentNode.levelCount) {
            queue.push(...currentNode.children)
            currentNode = queue.shift()
          }
          const listItemPath = Object.values(listItem).splice(1, levelCount)
          this.tree.nodeProperty.samePathNode = queue.find((item) => {
            let itemPath = []
            while (item.parent) {
              itemPath.unshift(item.label)
              item = item.parent
            }
            return itemPath.toString() == listItemPath.toString()
          })
        }
        const { samePathNode } = this.tree.nodeProperty
        let key = samePathNode ? samePathNode.key : initKey

        const nodeAttr = {
          ...this.tree.nodeProperty,
          label: label,
          key,
          sumType: null,
          originKey: getOriginKey(key),
          parentKey: tree.getParentId(treeNodeGroup),
          sumLastNode: false,
          sumNode: false
        }
        if (nodeAttr.levelType == CategoryType.Metrics) {
          nodeAttr[levelKey] = listItem[levelKey]
        }
        Array.prototype.push.call(
          nodeAttr.levelType == CategoryType.Metrics
            ? targetNodeGroup
            : treeNodeGroup,
          nodeAttr
        )
      })
      const levelItemByAttribute = [...treeNodeGroup, targetNodeGroup]
      levelItemByAttribute.forEach((levelItem, index) => {
        while (!Array.isArray(levelItem)) {
          levelItem = [levelItem]
        }
        levelItem.map((item) => {
          tree = tree.getAddToData(item, levelItemByAttribute[index - 1])
        })
      })
    })
  }

  public getFirstNotSum(node) {
    if (!node.sumNode) {
      return node
    }
    if (node.label == SumText.SubSum && node.parent.label !== SumText.SubSum) {
      return node.parent
    }
    node = node.parent
    return tree.getFirstNotSum(node)
  }

  public getPartBranch(parentNode) {
    const backParent = cloneDeep(parentNode)
    if (backParent.originKey === this.tree.wideProps.rowLast) {
      if (backParent.sumNode) {
        const args = { backParent, parentNode }
        while (
          !this.tree.labelText.rootKey.includes(args.backParent.originKey)
        ) {
          args.backParent = args.backParent.parent
        }
        return tree.getFirstNotSum(parentNode).children
      } else {
        return backParent.parent.children
      }
    }
  }

  public getChildGroup(item) {
    const queue = [item]
    let currentNode = queue.shift()
    while (
      currentNode &&
      currentNode.originKey !== this.tree.wideProps.colArray[0]
    ) {
      queue.push(...currentNode.children)
      currentNode = queue.shift()
    }
    return [...queue, currentNode]
  }

  public decidePolymerizeGroupEmpty(polymerizeGroup, node) {
    return (
      !polymerizeGroup.length ||
      polymerizeGroup.every((item) => item.label !== node.label)
    )
  }

  public getMergePartBranch(parentNode: ITreeNodeProperty) {
    const polymerizeGroup = []
    tree.getPartBranch(parentNode).forEach((item: ITreeNodeProperty) => {
      tree.getChildGroup(item).forEach((node) => {
        const metrics = this.tree.wideProps.metrics
        let colBeginNode = new Node(cloneDeep(node))
        colBeginNode.set(cloneDeep(node), metrics)
        if (tree.decidePolymerizeGroupEmpty(polymerizeGroup, node)) {
          polymerizeGroup.push(colBeginNode)
        } else {
          let origin: ITreeNodeProperty = polymerizeGroup.find(
            (item) => item.label == colBeginNode.label
          )
          const iteration = (origin, target) => {
            if (!origin && !target) {
              return
            }
            if (origin.label !== target.label) {
              return origin.parent.children.push(target)
            }
            target = target.children[0]
            origin =
              origin.children.find((item) => item.label == target.label) ||
              origin.children[0]
            return iteration(origin, target)
          }
          iteration(origin, colBeginNode)
        }
      })
    })
    return polymerizeGroup
  }

  public copyPolymerizeNormalNode(copyParems, polymerizeGroup) {
    const { deepCopy, isLastSumNode, parentNode, currentNode } = copyParems
    const group = polymerizeGroup || currentNode
    return group.reduce((sumNode, node) => {
      if (parentNode.originKey == this.tree.wideProps.colLast) {
        return sumNode
      } else {
        const polyNormalNode = deepCopy(
          { currentNode: node, parentNode },
          { isLastSumNode: false }
        )
        return sumNode.concat(polyNormalNode)
      }
    }, [])
  }

  public decideSumBranchType(node) {
    const isBeiginNoneParentSumKey = tree.getFirstNotSum(node).originKey

    if (isBeiginNoneParentSumKey === this.tree.labelText.rootKey[0]) {
      return SumType.RowTotal
    } else if (isBeiginNoneParentSumKey === this.tree.wideProps.rowLast) {
      return SumType.ColTotal
    } else if (
      isBeiginNoneParentSumKey !== this.tree.wideProps.rowLast &&
      this.tree.wideProps.rowArray.includes(isBeiginNoneParentSumKey)
    ) {
      return SumType.RowSubTotal
    } else if (
      this.tree.wideProps.colArray.includes(isBeiginNoneParentSumKey)
    ) {
      return SumType.ColSubTotal
    }
  }

  public getColArrayFirstParent(node) {
    while (node.originKey !== this.tree.wideProps.colArray[0]) {
      node = node.parent
    }
    return node
  }

  public decideSumNodeKeyTextDisplay(options) {
    const { nodeValue, isLastSumNode, indexNumber, currentNode } = options
    if (currentNode.levelType === CategoryType.Col && isLastSumNode) {
      return `${nodeValue}sumLastNode`
    } else {
      return `${nodeValue}${indexNumber}sumNode`
    }
  }

  public decideSumAttribute(options) {
    const {
      newNode,
      key,
      deepCopy,
      parentNode,
      nodeValue,
      isLastSumNode
    } = options
    switch (key) {
      case 'levelCount':
        newNode[key] = parentNode[key] + 1
      case 'parentKey':
        newNode[key] = parentNode.key
        break
      case 'parent':
        newNode[key] = parentNode
        break
      case 'key':
        newNode.key = tree.decideSumNodeKeyTextDisplay(options)
        newNode.originKey = getOriginKey(newNode.key)
        newNode.levelType = tree.getNodeLevelType(newNode.originKey)
        newNode.sumLastNode = !!isSumLastNode(newNode.key)
        newNode.sumNode = isSumNodeEnd(newNode.key)
        break
      case 'label':
        newNode[key] = tree.decideSumOrSubSumTextDisplay(options)
        newNode.sumType = tree.decideSumBranchType(parentNode)
        break
      case 'children':
        newNode[key] = tree.copyIteration(
          deepCopy,
          nodeValue,
          newNode,
          isLastSumNode
        )
        break
      default:
        newNode[key] = null
    }
  }

  public decideSumOrSubSumTextDisplay(options) {
    const { nodeValue, isLastSumNode, parentNode, newNode } = options
    const isMetricValue = parentNode.originKey == this.tree.wideProps.colLast
    const isParentRowLast = parentNode.originKey == this.tree.wideProps.rowLast

    const isRowSumText =
      !isParentRowLast &&
      [
        ...this.tree.wideProps.rowArray,
        ...this.tree.labelText.rootKey
      ].includes(parentNode.originKey) &&
      [SumType.RowTotal].includes(tree.decideSumBranchType(parentNode))
    const isColSumText =
      !isMetricValue &&
      [...this.tree.wideProps.colArray, this.tree.wideProps.rowLast].includes(
        parentNode.originKey
      ) &&
      [SumType.ColTotal].includes(tree.decideSumBranchType(parentNode))

    const isColStartSumText =
      (!isMetricValue &&
        this.tree.wideProps.colArray.includes(parentNode.originKey) &&
        tree.getColArrayFirstParent(parentNode).sumLastNode) ||
      (isParentRowLast && isLastSumNode && this.tree.wideProps.colArray.length)
    const isSubSumText =
      isLastSumNode && !isQuotaSum(nodeValue, this.tree.wideProps.metricsAgg)

    if (isRowSumText || isColSumText || isColStartSumText) {
      return SumText.Sum
    } else if (isSubSumText) {
      return SumText.SubSum
    } else {
      return nodeValue
    }
  }

  public getMetricNodeSubSumOrSumType(node) {
    const iteration = (node) => {
      if ([SumText.Sum, SumText.SubSum].includes(node.label)) return node.label
    }
    iteration(node)
  }

  public copyIteration(
    deepCopy,
    currentNode,
    parentNode,
    isLastSumNode = false
  ) {
    return deepCopy({ currentNode, parentNode }, { isLastSumNode })
  }

  public copyPolymerizeNoramlChild(copyParems) {
    const { parentNode, newNode, isLastSumNode } = copyParems
    let polymerizeGroup
    if (
      parentNode.originKey === this.tree.wideProps.rowLast &&
      this.tree.wideProps.colArray.length
    ) {
      polymerizeGroup = tree.getMergePartBranch(parentNode)
    }
    if (
      polymerizeGroup ||
      (!isLastSumNode && parentNode.levelType === CategoryType.Col)
    ) {
      return tree.copyPolymerizeNormalNode(copyParems, polymerizeGroup)
    }
    return newNode
  }

  public copyTotalNode(currentNode, parentNode) {
    let indexNumber = 0
    const deepCopy = (copyNode, copyOptions) => {
      indexNumber++
      const { currentNode, parentNode } = copyNode
      const { isLastSumNode = true } = copyOptions

      if (typeof currentNode !== 'object' || !currentNode) {
        return currentNode
      }

      let newNode
      if (Array.isArray(currentNode)) {
        newNode = []
      } else {
        const metrics = this.tree.wideProps.metrics
        newNode = new Node({})
        newNode.set({}, metrics)
      }
      const copyParems = {
        deepCopy,
        ...copyNode,
        ...copyOptions,
        newNode,
        indexNumber,
        isLastSumNode
      }
      if (currentNode.length) {
        newNode = tree.copyPolymerizeNoramlChild(copyParems)
        if (
          parentNode.originKey ===
          (this.tree.wideProps.colLast || this.tree.wideProps.rowLast)
        ) {
          currentNode.forEach((k) => {
            const copyNode = tree.copyIteration(deepCopy, k, parentNode, true)
            newNode.push(copyNode)
          })
        } else {
          const copyNode = tree.copyIteration(
            deepCopy,
            currentNode[0],
            parentNode,
            true
          )
          newNode.push(copyNode)
        }
      } else {
        Object.keys(currentNode).forEach((key) => {
          const exitedVal = Array.isArray(newNode[key])
            ? newNode[key].length
            : newNode[key]
          if (exitedVal) {
            return
          }
          const nodeValue = currentNode[key]
          const options = { nodeValue, key, ...copyParems }

          tree.decideSumAttribute(options)
        })
      }
      return newNode
    }
    return tree.copyIteration(deepCopy, currentNode, parentNode, true)
  }

  public getSumMultiwayTree() {
    const queue = [this.tree.wideProps.root]
    let currentNode = queue.shift()
    const {
      wideProps: { rowArray, colArray },
      labelText: { rootKey }
    } = this.tree
    const rowColConcat = [...rowArray, ...colArray]
    rowColConcat.splice(rowColConcat.length - 1, 1, ...rootKey)
    while (currentNode && rowColConcat.includes(currentNode.originKey)) {
      queue.push(...currentNode.children)
      currentNode.children.push(
        tree.copyTotalNode(currentNode.children[0], currentNode)
      )
      currentNode = queue.shift()
    }
  }

  public getMetricNodeList() {
    const queue = [this.tree.wideProps.root]
    let currentNode = queue.shift()
    queue.push(...currentNode.children)
    while (queue.length) {
      currentNode = queue.shift()
      if (this.tree.wideProps.metrics.includes(currentNode.label)) {
        this.tree.wideProps.metricNodeList.push(currentNode)
      }
      queue.push(...currentNode.children)
    }
  }

  public getUnSumNodeReduceSumMetrics(option) {
    const { children, key, callback } = option
    const { colLast, rowLast } = this.tree.wideProps
    const colLastNode = children[0].parent.originKey === (colLast || rowLast)
    return children
      .filter((item) => {
        if (colLastNode) {
          return callback(item) && item.originKey === key
        } else {
          return callback(item)
        }
      })
      .reduce((number, node) => {
        return (number = number + node[key])
      }, 0)
  }

  public getSumMetricDFS() {
    this.tree.wideProps.metricNodeList.forEach((node: ITreeNodeProperty) => {
      if (node.sumNode) {
        const getFirstNonSumParent = (origin: ITreeNodeProperty, path: Array<string>) => {
          while (origin.sumNode) {
            path.unshift(origin.label)
            origin = origin.parent
          }
          return {
            from: origin,
            path
          }
        }
        const { from, path } = getFirstNonSumParent(node, [])
        this.tree.wideProps.metrics.forEach((key: string) => {
          const needSum = this.tree.wideProps.metricsTotal[
            node.originKey
          ].includes(node.sumType)
          if (needSum) {
            tree.matchSameNodeSum(from.children, key, path)
          }
        })
      } else {
        while (node) {
          const callback = (node) => !node.sumNode
          if (this.tree.wideProps.metrics.includes(node.originKey)) {
            node[node.originKey] = node[node.originKey]
          } else {
            this.tree.wideProps.metrics.forEach((key) => {
              const option = {
                children: node.children,
                key,
                callback
              }
              node[key] = tree.getUnSumNodeReduceSumMetrics(option)
            })
          }
          node = node.parent
        }
        return
      }
    })
  }

  public matchSameNodeSum(currentQueue: Array<ITreeNodeProperty>, key: string, path: Array<string>) {
    let level: number = 0
    let needSumNodeGroup: Array<ITreeNodeProperty> = []
    let currentLevelSumNode: ITreeNodeProperty = currentQueue.find((node) => node.sumNode)
    while (currentQueue.length) {
      needSumNodeGroup = currentQueue.filter((node) => {
        if ([SumText.Sum, SumText.SubSum].includes(path[level])) {
          return node.label !== path[level]
        } else {
          return node.label == path[level]
        }
      })
      const callback = (node) => !node.sumNode
      const option = {
        children: needSumNodeGroup,
        key,
        callback
      }
      currentLevelSumNode[key] = tree.getUnSumNodeReduceSumMetrics(option)
      level++
      currentQueue = needSumNodeGroup.reduce((array: Array<ITreeNodeProperty>, item: ITreeNodeProperty) => {
        return array.concat(item.children)
      }, [])
      currentLevelSumNode = currentLevelSumNode.children.find(
        (item) => item.label === path[level]
      )
    }
  }

  private makeOriginJson() {
    const {
      resultWideList,
      colArray,
      rowArray,
      metricsTotal
    } = this.tree.wideProps
    const rowOrder = [...colArray, ...rowArray, ...Object.keys(metricsTotal)]
    this.tree.wideProps.resultList = resultWideList.reduce((pre, cur) => {
      const newObj = {}
      rowOrder.forEach((key) => {
        newObj[key] = cur[key]
      })
      return pre.concat(newObj)
    }, [])
  }

  public getTotalWideTableJson() {
    this.tree.wideProps.metricNodeList.forEach((item: ITreeNodeProperty, count: number) => {
      const len = this.tree.wideProps.metrics.length
      if (!(count % len)) {
        let obj = {}
        while (item.parent) {
          if (item.levelType === CategoryType.Metrics) {
            obj[item.originKey] = item[item.originKey]
          } else {
            obj[item.originKey] = item.label
          }
          item = item.parent
        }

        this.tree.wideProps.resultWideList.push(obj)
      } else {
        const resultWideListLast = this.tree.wideProps.resultWideList[
          this.tree.wideProps.resultWideList.length - 1
        ]
        resultWideListLast[item.originKey] = item[item.originKey]
      }
    })
  }

  public initProps(props) {
    const { rows, cols, metrics, data } = props
    this.tree.wideProps.colArray = rows.map((item) => `${item.name}_rows`)
    this.tree.wideProps.rowArray = cols.reduce((col, item) => {
      const repeatGroup = col.filter((item) => item === `${item.name}_cols`)
      const colItem = repeatGroup.length ? repeatGroup.length : ''
      col = [...col, `${item.name}_cols${colItem}`]
      return col
    }, [])
    this.tree.wideProps.metricsAgg = metrics.map((l) => l.agg)
    this.tree.wideProps.metricsTotal = metrics.reduce((result, item) => {
      result[`${item.agg}(${item.name.split('@')[0]})`] =
        item.total?.totalType || []
      return result
    }, {})
    const { rowArray, colArray, metricsTotal } = this.tree.wideProps
    this.tree.wideProps.wideTableList = data.reduce((result, cur) => {
      cur = [...rowArray, ...colArray, ...Object.keys(metricsTotal)].reduce(
        (obj, key) => {
          obj[key] = cur[replaceRowColPrx(key)]
          return obj
        },
        {}
      )
      return (result = [...result, cur])
    }, [])
  }

  public getSortSumNode(rows, rowKeys) {
    const breakFn = (rowKeys, idx) => {
      const levelSortKey = rowKeys.reduce((pre, cur) => {
        return (pre = Array.from(new Set([...pre, cur[idx]])))
      }, [])
      const sumText = levelSortKey.findIndex((key) =>
        [SumText.Sum, SumText.SubSum].includes(key)
      )
      levelSortKey.push(...levelSortKey.splice(sumText, 1))
      let partGroup = levelSortKey.reduce((pre, cur) => {
        const group = rowKeys.filter((item) => item[idx] === cur)
        return (pre = [...pre, group])
      }, [])
      if (idx == rows.length - 2) {
        const exitedSumGroup = partGroup.splice(0, partGroup.length - 1)
        exitedSumGroup.forEach((group, index) => {
          const sumText = exitedSumGroup[index].findIndex((k) =>
            [SumText.Sum, SumText.SubSum].includes(k[k.length - 1])
          )
          exitedSumGroup[index].push(
            ...exitedSumGroup[index].splice(sumText, 1)
          )
        })
        partGroup = [...exitedSumGroup, ...partGroup]
      }
      return partGroup
    }

    const iteration = (rowKeys, idx: number) => {
      if (!idx) return breakFn(rowKeys, idx)
      rowKeys = rowKeys.reduce((arr, item) => {
        const isArray = (group) => {
          return group.every((item) => Array.isArray(item))
        }
        if (!isArray(item.flat(1))) return (arr = [...arr, breakFn(item, idx)])
        const group = iteration(item, idx)
        return (arr = [...arr, group])
      }, [])
      return rowKeys
    }

    const getPartGroupByKey = (divideGroupByLevel, index) => {
      while (index <= Math.max(rows.length - 2, 0)) {
        divideGroupByLevel = iteration(divideGroupByLevel, index)
        index++
      }
      return divideGroupByLevel
    }

    const result = getPartGroupByKey(rowKeys, 0)

    const flatItem = (result) => {
      while (!result[0].every((d) => !Array.isArray(d))) {
        result = result.reduce((pre, cur) => {
          return (pre = [...pre, ...cur])
        }, [])
      }
      return result
    }
    return flatItem(result)
  }

  public getDefaultProps() {
    const { rowArray, colArray, metricsTotal } = this.tree.wideProps
    this.tree.wideProps.root = null
    this.tree.wideProps.metricNodeList = []
    this.tree.wideProps.resultWideList = []
    this.tree.wideProps.rowLast = rowArray[rowArray.length - 1]
    this.tree.wideProps.colLast = colArray[colArray.length - 1]
    this.tree.wideProps.metrics = Object.keys(metricsTotal) || []
  }

  public getTotalWideTableList(props) {
    tree.initProps(props)
    tree.getDefaultProps()
    tree.getMultiwayTree()
    tree.getSumMultiwayTree()
    tree.getMetricNodeList()
    tree.getSumMetricDFS()
    tree.getTotalWideTableJson()
    tree.makeOriginJson()
    console.log(tree, 'tree')
    return tree
  }
}

let tree = new MultiwayTree()

export default tree
