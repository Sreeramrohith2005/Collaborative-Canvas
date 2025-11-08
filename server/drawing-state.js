function createDrawingState() {
  /** @type {Array<any>} */
  let ops = []; // committed operations in order
  /** @type {Array<any>} */
  let redoStack = []; // for global redo

  return {
    append(op) {
      ops.push(op);
      redoStack = []; // new branch clears redo
      return op;
    },
    undo() {
      if (ops.length === 0) return null;
      const op = ops.pop();
      redoStack.push(op);
      return op;
    },
    redo() {
      if (redoStack.length === 0) return null;
      const op = redoStack.pop();
      ops.push(op);
      return op;
    },
    clear() {
      ops = [];
      redoStack = [];
    },
    getOps() { return ops.slice(); },
    getRedoOps() { return redoStack.slice(); }
  };
}

module.exports = { createDrawingState };
