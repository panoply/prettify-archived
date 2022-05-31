import { prettydiff } from '../parser/prettydiff';
import { PrettyDiffOptions } from '../../types/prettydiff';

export default (function beautify_script_init () {

  const script = function script (options: PrettyDiffOptions) {

    let scolon = 0;
    let news = 0;

    const externalIndex = {};
    const data = options.parsed;
    const lexer = 'script';
    const scopes = prettydiff.scopes;
    const b = (prettydiff.end < 1 || prettydiff.end > data.token.length) ? data.token.length : prettydiff.end + 1;

    // levels sets the white space value between the current token and the next token
    // * -20 value means no white space
    // * -10 means to separate with a space
    // * 0 and above is the number of indentation to insert
    const levels = (() => {

      let a = prettydiff.start; // will store the current level of indentation
      let indent = (isNaN(options.indentLevel) === true) ? 0 : Number(options.indentLevel);

      let notcomment = false; // if in comments before any code
      let lastlist = false; // remembers the list status of the most recently closed block
      let ctype = ''; // ctype stands for "current type"
      let ctoke = ''; // ctoke standa for "current token"
      let ltype = data.types[0]; // ltype stands for "last type"
      let ltoke = data.token[0]; // ltype stands for "last token"

      const varindex = [ -1 ]; // index in current scope of last var, let, or const keyword
      const list = []; // stores comma status of current block
      const level = (prettydiff.start > 0) ? Array(prettydiff.start).fill(0, 0, prettydiff.start) : [];

      const ternary = []; // used to identify ternary statments

      // stores token indexes where extra indentation occurs from ternaries and broken method chains
      const extraindent = [ [] ];
      const arrbreak = []; // array where a method break has occurred
      const destruct = []; // attempt to identify object destructuring
      const itemcount = []; // counts items in destructured lists
      const assignlist = [ false ]; // are you in a list right now?
      const wordlist = [];
      const count = [];

      function comment () {

        destructfix(false, false);

        const ind = (options.commentIndent === true) ? 0 : indent;

        if (notcomment === false && (/\/\u002a\s*global\s/).test(data.token[a])) {

          const globallist = data.token[a]
            .replace(/\/\u002a\s*global\s+/, '')
            .replace(/\s*\u002a\/$/, '')
            .split(',');

          let aa = globallist.length;

          do {

            aa = aa - 1;
            globallist[aa] = globallist[aa].replace(/\s+/g, '');

            if (globallist[aa] !== '') scopes.push([ globallist[aa], -1 ]);

          } while (aa > 0);
        }

        if (data.types[a - 1] === 'comment' || data.types[a + 1] === 'comment') {
          level[a - 1] = ind;
        } else if (data.lines[a] < 2) {

          let aa = a + 1;

          if (data.types[aa] === 'comment') {
            do {
              aa = aa + 1;
            } while (aa < b && data.types[aa] === 'comment');
          }

          if (
            a < b - 1 && data.stack[aa] !== 'block' && (
              data.token[aa] === '{' ||
              data.token[aa] === 'x{'
            )
          ) {

            let bb = scopes.length;

            data.begin.splice(a, 0, data.begin[aa]);
            data.ender.splice(a, 0, data.ender[aa]);
            data.lexer.splice(a, 0, data.lexer[aa]);
            data.lines.splice(a, 0, data.lines[aa]);
            data.stack.splice(a, 0, data.stack[aa]);
            data.token.splice(a, 0, data.token[aa]);
            data.types.splice(a, 0, data.types[aa]);

            if (bb > 0) {
              do {
                bb = bb - 1;
                if (scopes[bb][1] === aa) {
                  scopes[bb][1] = a;
                } else if (scopes[bb][1] < a) {
                  break;
                }
              } while (bb > 0);
            }

            aa = aa + 1;
            data.begin.splice(aa, 1);
            data.ender.splice(aa, 1);
            data.lexer.splice(aa, 1);
            data.lines.splice(aa, 1);
            data.stack.splice(aa, 1);
            data.token.splice(aa, 1);
            data.types.splice(aa, 1);
            bb = a + 1;

            do {
              data.begin[bb] = a;
              data.stack[bb] = data.stack[aa];
              bb = bb + 1;
            } while (bb < aa);

            bb = bb + 1;

            do {

              if (data.begin[bb] === data.begin[aa]) {
                data.begin[bb] = a;
                if (data.types[bb] === 'end') {
                  break;
                }
              }

              bb = bb + 1;
            } while (bb < b - 1);

            data.begin[aa] = a;

            a = a - 1;

          } else {

            level[a - 1] = -10;

            if (data.stack[a] === 'paren' || data.stack[a] === 'method') {
              level.push(indent + 2);
            } else {
              level.push(indent);
            }

            if (options.commentNewline === true && level[a] > -1 && data.lines[a] < 3) {
              data.lines[a] = 3;
            }
          }

          if (data.types[a + 1] !== 'comment') notcomment = true;

          return;

        } else if (data.token[a - 1] === ',') {

          level[a - 1] = ind;

        } else if (
          ltoke === '=' &&
          data.types[a - 1] !== 'comment' &&
          (/^(\/\*\*\s*@[a-z_]+\s)/).test(ctoke) === true
        ) {

          level[a - 1] = -10;

        } else if (ltoke === '{' && data.types[a - 1] !== 'comment' && data.lines[0] < 2) {

          level[a - 1] = -10;

        } else {

          level[a - 1] = ind;

        }

        if (data.types[a + 1] !== 'comment') notcomment = true;

        if (data.token[data.begin[a]] === '(') {
          level.push(indent + 1);
        } else {
          level.push(indent);
        }

        if (options.commentNewline === true && level[a] > -1 &&
                data.lines[a] < 3) {
          data.lines[a] = 3;
        }
      };

      function destructfix (listFix: boolean, override: boolean) {

        // listfix  - at the end of a list correct the containing list override - to
        // break arrays with more than 4 items into a vertical list
        let c = a - 1;
        let d = (listFix === true) ? 0 : 1;

        const ei = (extraindent[extraindent.length - 1] === undefined)
          ? []
          : extraindent[extraindent.length - 1];

        const arrayCheck = (
          override === false &&
          data.stack[a] === 'array' &&
          listFix === true &&
          ctoke !== '['
        );

        if (
          destruct[destruct.length - 1] === false || (
            data.stack[a] === 'array' &&
            options.arrayFormat === 'inline'
          ) || (
            data.stack[a] === 'object' &&
            options.objectIndent === 'inline'
          )
        ) {
          return;
        }

        destruct[destruct.length - 1] = false;

        do {
          if (data.types[c] === 'end') {
            d = d + 1;
          } else if (data.types[c] === 'start') {
            d = d - 1;
          }
          if (data.stack[c] === 'global') {
            break;
          }
          if (d === 0) {

            if (
              data.stack[a] === 'class' ||
              data.stack[a] === 'map' || (
                arrayCheck === false && (
                  (
                    listFix === false &&
                    data.token[c] !== '(' &&
                    data.token[c] !== 'x('
                  ) || (
                    listFix === true &&
                    data.token[c] === ','
                  )
                )
              )
            ) {

              if (data.types[c + 1] === 'template_start') {

                if (data.lines[c] < 1) {
                  level[c] = -20;
                } else {
                  level[c] = indent - 1;
                }

              } else if (ei.length > 0 && ei[ei.length - 1] > -1) {
                level[c] = indent - 1;
              } else {
                level[c] = indent;
              }

            } else if (data.stack[a] === 'array' && data.types[a] === 'operator') {

              if (data.token[c] === ',') level[c] = indent;
              if (c === data.begin[a]) break;

            }

            if (listFix === false) break;

          }

          if (d < 0) {

            if (
              data.types[c + 1] === 'template_start' ||
              data.types[c + 1] === 'template_string_start'
            ) {

              if (data.lines[c] < 1) {
                level[c] = -20;
              } else {
                level[c] = indent - 1;
              }

            } else if (ei.length > 0 && ei[ei.length - 1] > -1) {
              level[c] = indent - 1;
            } else {
              level[c] = indent;
            }
            break;
          }

          c = c - 1;

        } while (c > -1);

      };

      function end () {

        const ei = (extraindent[extraindent.length - 1] === undefined)
          ? []
          : extraindent[extraindent.length - 1];

        function markupList () {

          let aa = a;
          let markup = false;

          const begin = data.begin[aa];

          do {

            aa = aa - 1;

            if (data.lexer[aa] === 'markup') {
              markup = true;
              break;
            }

            if (data.begin[aa] !== begin) aa = data.begin[aa];

          } while (aa > begin);

          if (markup === true) {

            aa = a;

            do {
              aa = aa - 1;
              if (data.begin[aa] !== begin) {
                aa = data.begin[aa];
              } else if (data.token[aa] === ',') {
                level[aa] = indent + 1;
              }
            } while (aa > begin);

            level[begin] = indent + 1;
            level[a - 1] = indent;

          } else {
            level[a - 1] = -20;
          }
        };

        if (
          ctoke === ')' &&
          data.token[a + 1] === '.' &&
          ei[ei.length - 1] > -1 &&
          data.token[ei[0]] !== ':'
        ) {

          let c = data.begin[a];
          let d = false;
          let e = false;

          do { c = c - 1; } while (c > 0 && level[c] < -9);

          d = (level[c] === indent);
          c = a + 1;

          do {

            c = c + 1;

            if (data.token[c] === '{') {
              e = true;
              break;
            }

            if (
              data.begin[c] === data.begin[a + 1] && (
                data.types[c] === 'separator' ||
                data.types[c] === 'end'
              )
            ) {
              break;
            }

          } while (c < b);

          if (
            d === false &&
            e === true &&
            extraindent.length > 1
          ) {
            extraindent[extraindent.length - 2].push(data.begin[a]);
            indent = indent + 1;
          }
        }

        if (ltype !== 'separator') fixchain();

        if (
          data.token[a + 1] === ',' && (
            data.stack[a] === 'object' ||
            data.stack[a] === 'array'
          )
        ) {
          destructfix(true, false);
        }

        if (
          (
            data.token[a + 1] === '}' ||
            data.token[a + 1] === ']'
          ) && (
            data.stack[a] === 'object' ||
            data.stack[a] === 'array'
          ) &&
          data.token[data.begin[a] - 1] === ','
        ) {
          destructfix(true, false);
        }

        if (data.stack[a] !== 'attribute') {

          if (
            ctoke !== ')' &&
            ctoke !== 'x)' && (
              data.lexer[a - 1] !== 'markup' || (
                data.lexer[a - 1] === 'markup' &&
                data.token[a - 2] !== 'return'
              )
            )
          ) {
            indent = indent - 1;
          }

          if (
            ctoke === '}' &&
            data.stack[a] === 'switch' &&
            options.noCaseIndent === false
          ) {
            indent = indent - 1;
          }
        }

        if (ctoke === '}' || ctoke === 'x}') {

          if (
            data.types[a - 1] !== 'comment' &&
            ltoke !== '{' &&
            ltoke !== 'x{' &&
            ltype !== 'end' &&
            ltype !== 'string' &&
            ltype !== 'number' &&
            ltype !== 'separator' &&
            ltoke !== '++' &&
            ltoke !== '--' && (
              a < 2 ||
              data.token[a - 2] !== ';' ||
              data.token[a - 2] !== 'x;' ||
              ltoke === 'break' ||
              ltoke === 'return'
            )
          ) {

            let c = a - 1;
            let assign = false;

            const begin = data.begin[a];
            const listlen = list.length;

            do {

              if (data.begin[c] === begin) {

                if (data.token[c] === '=' || data.token[c] === ';' || data.token[c] === 'x;') {
                  assign = true;
                }

                if (data.token[c] === '.' && level[c - 1] > -1) {

                  // setting destruct is necessary to prevent a rule below
                  destruct[destruct.length - 1] = false;
                  level[begin] = indent + 1;
                  level[a - 1] = indent;
                  break;
                }

                if (
                  c > 0 &&
                  data.token[c] === 'return' && (
                    data.token[c - 1] === ')' ||
                    data.token[c - 1] === 'x)' ||
                    data.token[c - 1] === '{' ||
                    data.token[c - 1] === 'x{' ||
                    data.token[c - 1] === '}' ||
                    data.token[c - 1] === 'x}' ||
                    data.token[c - 1] === ';' ||
                    data.token[c - 1] === 'x;'
                  )
                ) {

                  indent = indent - 1;
                  level[a - 1] = indent;
                  break;
                }

                if (
                  (
                    data.token[c] === ':' &&
                    ternary.length === 0
                  ) || (
                    data.token[c] === ',' &&
                    assign === false
                  )
                ) {
                  break;
                }

                if (
                  (
                    c === 0 ||
                    data.token[c - 1] === '{' ||
                    data.token[c - 1] === 'x{'
                  ) ||
                  data.token[c] === 'for' ||
                  data.token[c] === 'if' ||
                  data.token[c] === 'do' ||
                  data.token[c] === 'function' ||
                  data.token[c] === 'while' ||
                  data.token[c] === 'var' ||
                  data.token[c] === 'let' ||
                  data.token[c] === 'const' ||
                  data.token[c] === 'with'
                ) {

                  if (
                    list[listlen - 1] === false &&
                    listlen > 1 && (
                      a === b - 1 || (
                        data.token[a + 1] !== ')' &&
                        data.token[a + 1] !== 'x)'
                      )
                    ) &&
                    data.stack[a] !== 'object'
                  ) {
                    indent = indent - 1;
                  }

                  break;
                }

              } else {
                c = data.begin[c];
              }

              c = c - 1;

            } while (c > begin);
          }

          varindex.pop();
        }

        if (options.bracePadding === false && ctoke !== '}' && ltype !== 'markup' as any) {
          level[a - 1] = -20;
        }

        if (
          options.bracePadding === true &&
          ltype !== 'start' &&
          ltoke !== ';' && (
            level[data.begin[a]] < -9 ||
            destruct[destruct.length - 1] === true
          )
        ) {
          level[data.begin[a]] = -10;
          level[a - 1] = -10;
          level.push(-20);

        } else if (data.stack[a] === 'attribute') {

          level[a - 1] = -20;
          level.push(indent);

        } else if (
          data.stack[a] === 'array' && (
            ei.length > 0 ||
            arrbreak[arrbreak.length - 1] === true
          )
        ) {

          endExtraInd();
          destruct[destruct.length - 1] = false;
          level[data.begin[a]] = indent + 1;
          level[a - 1] = indent;
          level.push(-20);

        } else if (
          (
            data.stack[a] === 'object' || (
              data.begin[a] === 0 &&
              ctoke === '}'
            )
          ) &&
          ei.length > 0
        ) {

          endExtraInd();
          destruct[destruct.length - 1] = false;
          level[data.begin[a]] = indent + 1;
          level[a - 1] = indent;
          level.push(-20);

        } else if (ctoke === ')' || ctoke === 'x)') {

          const countx = (ctoke === ')' && ltoke !== '(' && count.length > 0) ? count.pop() + 1 : 0;
          const countIf = (data.token[data.begin[a] - 1] === 'if') ? (
            function () {

              let bb = a;

              do {
                bb = bb - 1;
                if (data.token[bb] === ')' && level[bb - 1] > -1) return countx;
              } while (bb > data.begin[a]);

              return countx + 5;

            }()
          ) : countx;

          if (
            countx > 0 && (
              options.language !== 'jsx' || (
                options.language === 'jsx' &&
                data.token[data.begin[a] - 1] !== 'render'
              )
            )
          ) {

            const wrap = options.wrap;
            const begin = data.begin[a];
            const len = count.length;

            let aa = a - 2;

            if (countIf > wrap) {

              level[data.begin[a]] = indent + 1;
              level[a - 1] = indent;

              do {

                if (data.begin[aa] === begin) {

                  if (data.token[aa] === '&&' || data.token[aa] === '||') {

                    level[aa] = indent + 1;

                  } else if (
                    level[aa] > -1 &&
                    data.types[aa] !== 'comment' &&
                    data.token[aa + 1] !== '.'
                  ) {
                    level[aa] = level[aa] + 1;
                  }

                } else if (level[aa] > -1 && data.token[aa + 1] !== '.') {
                  level[aa] = level[aa] + 1;
                }

                aa = aa - 1;

              } while (aa > begin);

            } else if (len > 0) {

              count[len - 1] = count[len - 1] + countx;
            }

          } else if (
            ctoke === ')' &&
            a > data.begin[a] + 2 &&
            data.lexer[data.begin[a] + 1] === lexer &&
            data.token[data.begin[a] + 1] !== 'function'
          ) {

            const open = (data.begin[a] < 0) ? 0 : data.begin[a];
            const wrap = options.wrap;
            const exl = ei.length;

            let len = 0;
            let aa = 0;
            let short = 0;
            let first = 0;
            let inc = 0;
            let comma = false;
            let array = false;
            let ind = (indent + 1);
            let ready = false;
            let mark = false;
            let tern = false;

            if (level[open] < -9) {

              aa = open;

              do { aa = aa + 1; } while (aa < a && level[aa] < -9);

              first = aa;

              do {

                len = len + data.token[aa].length;

                if (level[aa] === -10) len = len + 1;

                if (
                  data.token[aa] === '(' &&
                  short > 0 &&
                  short < wrap - 1 &&
                  first === a
                ) {
                  short = -1;
                }

                if (data.token[aa] === ')') {
                  inc = inc - 1;
                } else if (data.token[aa] === '(') {
                  inc = inc + 1;
                }

                if (aa === open && inc > 0) short = len;

                aa = aa - 1;

              } while (aa > open && level[aa] < -9);

              if (data.token[aa + 1] === '.') ind = level[aa] + 1;

              if (
                len > wrap - 1 &&
                wrap > 0 &&
                ltoke !== '(' &&
                short !== -1 && destruct[destruct.length - 2] === false
              ) {

                if (
                  (
                    data.token[open - 1] === 'if' &&
                    list[list.length - 1] === true
                  ) ||
                  data.token[open - 1] !== 'if'
                ) {

                  level[open] = ind;

                  if (data.token[open - 1] === 'for') {

                    aa = open;

                    do {

                      aa = aa + 1;

                      if (data.token[aa] === ';' && data.begin[
                        aa] === open) {
                        level[aa] = ind;
                      }

                    } while (aa < a);
                  }
                }
              }
            }

            aa = a;
            len = 0;

            do {

              aa = aa - 1;

              if (data.stack[aa] === 'function') {

                aa = data.begin[aa];

              } else if (data.begin[aa] === open) {

                if (data.token[aa] === '?') {

                  tern = true;
                } else if (data.token[aa] === ',' && comma === false) {
                  comma = true;

                  if (len >= wrap && wrap > 0) ready = true;

                } else if (data.types[aa] === 'markup' as any && mark === false) {
                  mark = true;
                }

                if (level[aa] > -9 && data.token[aa] !== ',' && data.types[aa] !== 'markup' as any) {
                  len = 0;
                } else {

                  if (level[aa] === -10) len = len + 1;

                  len = len + data.token[aa].length;

                  if (len >= wrap && wrap > 0 && (comma === true || mark === true)) {
                    ready = true;
                  }

                }

              } else {

                if (level[aa] > -9) {
                  len = 0;
                } else {

                  len = len + data.token[aa].length;
                  if (len >= wrap && wrap > 0 && (comma === true || mark === true)) {
                    ready = true;
                  }
                }
              }

            } while (aa > open && ready === false);

            if (
              comma === false &&
              data.token[data.begin[a] + 1].charAt(0) === '`'
            ) {
              level[data.begin[a]] = -20;
              level[a - 1] = -20;
            } else if (
              (
                (
                  comma === true ||
                  mark === true
                ) &&
                len >= wrap &&
                wrap > 0) ||
              level[open] > -9
            ) {

              if (tern === true) {

                ind = level[open];

                if (data.token[open - 1] === '[') {

                  aa = a;

                  do {
                    aa = aa + 1;
                    if (
                      data.types[aa] === 'end' ||
                      data.token[aa] === ',' ||
                      data.token[aa] === ';'
                    ) {
                      break;
                    }
                  } while (aa < b);

                  if (data.token[aa] === ']') {
                    ind = ind - 1;
                    array = true;
                  }
                }

              } else if (exl > 0 && ei[exl - 1] > aa) {
                ind = ind - exl;
              }

              destruct[destruct.length - 1] = false;
              aa = a;

              do {
                aa = aa - 1;

                if (data.begin[aa] === open) {

                  if (
                    data.token[aa].indexOf('=') > -1 &&
                    data.types[aa] === 'operator' &&
                    data.token[aa].indexOf('!') < 0 &&
                    data.token[aa].indexOf('==') < 0 &&
                    data.token[aa] !== '<=' && data.token[aa].indexOf('>') < 0
                  ) {

                    len = aa;

                    do {
                      len = len - 1;
                      if (
                        data.begin[len] === open && (
                          data.token[len] === ';' ||
                          data.token[len] === ',' ||
                          len === open
                        )
                      ) {
                        break;
                      }

                    } while (len > open);

                  } else if (data.token[aa] === ',') {

                    level[aa] = ind;

                  } else if (
                    level[aa] > -9 &&
                    array === false && (
                      data.token[open - 1] !== 'for' ||
                      data.token[aa + 1] === '?' ||
                      data.token[aa + 1] === ':'
                    ) && (
                      data.token[data.begin[a]] !== '(' ||
                      data.token[aa] !== '+'
                    )
                  ) {
                    level[aa] = level[aa] + 1;
                  }

                } else if (level[aa] > -9 && array === false) {
                  level[aa] = level[aa] + 1;
                }

              } while (aa > open);

              level[open] = ind;
              level[a - 1] = ind - 1;

            } else {
              level[a - 1] = -20;
            }

            if (data.token[data.begin[a] - 1] === '+' && level[data.begin[a]] > -9) {
              level[data.begin[a] - 1] = -10;
            }

          } else if (options.language === 'jsx') {
            markupList();
          } else {
            level[a - 1] = -20;
          }

          level.push(-20);

        } else if (destruct[destruct.length - 1] === true) {

          if (
            ctoke === ']' &&
            data.begin[a] - 1 > 0 &&
            data.token[data.begin[data.begin[a] - 1]] === '['
          ) {
            destruct[destruct.length - 2] = false;
          }

          if (data.begin[a] < level.length) level[data.begin[a]] = -20;

          if (options.language === 'jsx') {
            markupList();
          } else if (ctoke === ']' && level[data.begin[a]] > -1) {
            level[a - 1] = level[data.begin[a]] - 1;
          } else {
            level[a - 1] = -20;
          }

          level.push(-20);

        } else if (
          data.types[a - 1] === 'comment' &&
          data.token[a - 1].substring(0, 2) === '//'
        ) {

          if (data.token[a - 2] === 'x}') level[a - 3] = indent + 1;

          level[a - 1] = indent;
          level.push(-20);

        } else if (
          data.types[a - 1] !== 'comment' && (
            (
              ltoke === '{' &&
              ctoke === '}'
            ) || (
              ltoke === '[' &&
              ctoke === ']'
            )
          )
        ) {

          level[a - 1] = -20;
          level.push(-20);

        } else if (ctoke === ']') {

          if (
            (
              list[list.length - 1] === true &&
              destruct[destruct.length - 1] === false &&
              options.arrayFormat !== 'inline'
            ) || (
              ltoke === ']' && level[a - 2] === indent + 1
            )
          ) {

            level[a - 1] = indent;
            level[data.begin[a]] = indent + 1;

          } else if (level[a - 1] === -10) {
            level[a - 1] = -20;
          }

          if (data.token[data.begin[a] + 1] === 'function') {

            level[a - 1] = indent;

          } else if (list[list.length - 1] === false) {

            if (ltoke === '}' || ltoke === 'x}') level[a - 1] = indent;

            let c = a - 1;
            let d = 1;

            do {

              if (data.token[c] === ']') d = d + 1;
              if (data.token[c] === '[') {

                d = d - 1;

                if (d === 0) {

                  if (
                    c > 0 && (
                      data.token[c + 1] === '{' ||
                      data.token[c + 1] === 'x{' ||
                      data.token[c + 1] === '['
                    )
                  ) {
                    level[c] = indent + 1;
                    break;
                  }

                  if (data.token[c + 1] !== '[' || lastlist === false) {
                    level[c] = -20;
                    break;
                  }

                  break;
                }
              }

              if (d === 1 && data.token[c] === '+' && level[c] > 1) {
                level[c] = level[c] - 1;
              }

              c = c - 1;

            } while (c > -1);

          } else if (options.language === 'jsx') {
            markupList();
          }

          if (options.arrayFormat === 'inline') {

            let c = a;
            const begin = data.begin[a];

            do {

              c = c - 1;
              if (data.types[c] === 'end') break;

            } while (c > begin);

            if (c > begin) {
              level[data.begin[a]] = indent + 1;
              level[a - 1] = indent;
            } else {
              level[data.begin[a]] = -20;
              level[a - 1] = -20;
            }

          } else if (level[data.begin[a]] > -1) {

            level[a - 1] = level[data.begin[a]] - 1;
          }

          level.push(-20);

        } else if (
          ctoke === '}' ||
          ctoke === 'x}' ||
          list[list.length - 1] === true
        ) {

          if (
            ctoke === '}' &&
            ltoke === 'x}' &&
            data.token[a + 1] === 'else'
          ) {

            level[a - 2] = indent + 2;
            level.push(-20);

          } else {
            level.push(indent);
          }

          level[a - 1] = indent;

        } else {
          level.push(-20);
        }

        if (data.types[a - 1] === 'comment') level[a - 1] = indent;

        endExtraInd();

        lastlist = list[list.length - 1];

        list.pop();
        extraindent.pop();
        arrbreak.pop();
        itemcount.pop();
        wordlist.pop();
        destruct.pop();
        assignlist.pop();

      };

      function endExtraInd () {

        let c = 0;
        const ei = extraindent[extraindent.length - 1];

        if (ei === undefined) return;

        c = ei.length - 1;

        if (
          c < 1 &&
          ei[c] < 0 && (
            ctoke === ';' ||
            ctoke === 'x;' ||
            ctoke === ')' ||
            ctoke === 'x)' ||
            ctoke === '}' ||
            ctoke === 'x}'
          )
        ) {
          ei.pop();
          return;
        }

        if (c < 0 || ei[c] < 0) return;

        if (ctoke === ':') {

          if (data.token[ei[c]] !== '?') {

            do {
              ei.pop();
              c = c - 1;
              indent = indent - 1;
            } while (c > -1 && ei[c] > -1 && data.token[ei[c]] !== '?');
          }

          ei[c] = a;
          level[a - 1] = indent;
        } else {

          do {
            ei.pop();
            c = c - 1;
            indent = indent - 1;
          } while (c > -1 && ei[c] > -1);
        }

        if ((data.stack[a] === 'array' || ctoke === ',') && ei.length < 1) ei.push(-1);

      };

      function external () {

        const skip = a;

        do {

          if (data.lexer[a + 1] === lexer && data.begin[a + 1] < skip) break;

          if (
            data.token[skip - 1] === 'return' &&
            data.types[a] === 'end' &&
            data.begin[a] === skip
          ) break;

          level.push(0);

          a = a + 1;

        } while (a < b);

        externalIndex[skip] = a;
        level.push(indent - 1);

      };

      // beautify_script_level_fixchain
      function fixchain () {

        let bb = a - 1;

        const cc = data.begin[a];

        if (indent < 1) return;

        do {

          if (cc !== data.begin[bb]) {
            bb = data.begin[bb];
          } else {

            if (data.types[bb] === 'separator' || data.types[bb] === 'operator') {

              if (data.token[bb] === '.' && level[bb - 1] > 0) {
                if (data.token[cc - 1] === 'if') {
                  indent = indent - 2;
                } else {
                  indent = indent - 1;
                }
              }

              break;
            }
          }

          bb = bb - 1;

        } while (bb > 0 && bb > cc);
      };

      // beautify_script_level_markup
      function markup () {

        if (
          (
            data.token[a + 1] !== ',' &&
            ctoke.indexOf('/>') !== ctoke.length - 2
          ) || (
            data.token[a + 1] === ',' &&
            data.token[data.begin[a] - 3] !== 'React'
          )
        ) {
          destructfix(false, false);
        }

        if (ltoke === 'return' || ltoke === '?' || ltoke === ':') {
          level[a - 1] = -10;
          level.push(-20);
        } else if (
          ltype === 'start' || (
            data.token[a - 2] === 'return' &&
            data.stack[a - 1] === 'method'
          )
        ) {

          level.push(indent);
        } else {
          level.push(-20);
        }

      };

      // beautify_script_level_operator
      function operator () {

        const ei = (extraindent[extraindent.length - 1] === undefined)
          ? []
          : extraindent[extraindent.length - 1];

        function opWrap () {

          const aa = data.token[a + 1];

          let line = 0;
          let next = 0;
          let c = a;
          let ind = (ctoke === '+') ? indent + 2 : indent;
          let meth = 0;

          if (options.wrap < 1) {
            level.push(-10);
            return;
          }

          do {

            c = c - 1;

            if (data.token[data.begin[a]] === '(') {
              if (c === data.begin[a]) {
                meth = line;
              }

              if (
                data.token[c] === ',' &&
                data.begin[c] === data.begin[a] &&
                list[list.length - 1] === true) {
                break;
              }
            }

            if (line > options.wrap - 1) break;
            if (level[c] > -9) break;

            if (
              data.types[c] === 'operator' &&
              data.token[c] !== '=' &&
              data.token[c] !== '+' &&
              data.begin[c] === data.begin[a]
            ) {
              break;
            }

            line = line + data.token[c].length;

            if (
              c === data.begin[a] &&
              data.token[c] === '[' &&
              line < options.wrap - 1
            ) {
              break;
            }

            if (data.token[c] === '.' && level[c] > -9) break;
            if (level[c] === -10) line = line + 1;

          } while (c > 0);

          if (meth > 0) meth = meth + aa.length;

          line = line + aa.length;
          next = c;

          if (line > options.wrap - 1 && level[c] < -9) {
            do { next = next - 1; } while (next > 0 && level[next] < -9);
          }

          if (data.token[next + 1] === '.' && data.begin[a] <= data.begin[next]) {
            ind = ind + 1;
          } else if (data.types[next] === 'operator') {
            ind = level[next];
          }

          next = aa.length;

          if (line + next < options.wrap) {
            level.push(-10);
            return;
          }

          if (
            data.token[data.begin[a]] === '(' && (
              data.token[ei[0]] === ':' ||
              data.token[ei[0]] === '?'
            )
          ) {
            ind = indent + 3;
          } else if (data.stack[a] === 'method') {

            level[data.begin[a]] = indent;

            if (list[list.length - 1] === true) {
              ind = indent + 3;
            } else {
              ind = indent + 1;
            }

          } else if (
            data.stack[a] === 'object' ||
            data.stack[a] === 'array'
          ) {
            destructfix(true, false);
          }

          if (
            data.token[c] === 'var' ||
            data.token[c] === 'let' ||
            data.token[c] === 'const'
          ) {

            line = line - (options.indentSize * options.indentChar.length * 2);
          }

          if (meth > 0) {
            c = options.wrap - meth;
          } else {
            c = options.wrap - line;
          }

          if (c > 0 && c < 5) {

            level.push(ind);

            if (
              data.token[a].charAt(0) === '"' ||
              data.token[a].charAt(0) === "'"
            ) {
              a = a + 1;
              level.push(-10);
            }

            return;
          }

          if (data.token[data.begin[a]] !== '(' || meth > options.wrap - 1 || meth === 0) {

            if (meth > 0) line = meth;

            if (
              line - aa.length < options.wrap - 1 && (
                aa.charAt(0) === '"' ||
                aa.charAt(0) === "'"
              )
            ) {

              a = a + 1;
              line = line + 3;

              if (line - aa.length > options.wrap - 4) {
                level.push(ind);
                return;
              }

              level.push(-10);
              return;

            }

            level.push(ind);
            return;
          }

          level.push(-10);

        };

        fixchain();

        if (
          ei.length > 0 &&
          ei[ei.length - 1] > -1 &&
          data.stack[a] === 'array'
        ) {
          arrbreak[arrbreak.length - 1] = true;
        }

        if (ctoke !== ':') {

          if (
            data.token[data.begin[a]] !== '(' &&
            data.token[data.begin[a]] !== 'x(' &&
            destruct.length > 0
          ) {
            destructfix(true, false);
          }

          if (
            ctoke !== '?' &&
            data.token[ei[ei.length - 1]] === '.'
          ) {

            let e = 0;
            let c = a;

            const d = data.begin[c];

            do {

              if (data.begin[c] === d) {

                if (
                  data.token[c + 1] === '{' ||
                  data.token[c + 1] === '[' ||
                  data.token[c] === 'function'
                ) {
                  break;
                }

                if (
                  data.token[c] === ',' ||
                  data.token[c] === ';' ||
                  data.types[c] === 'end' ||
                  data.token[c] === ':'
                ) {
                  ei.pop();
                  indent = indent - 1;
                  break;
                }

                if (data.token[c] === '?' || data.token[c] === ':') {
                  if (data.token[ei[ei.length - 1]] === '.' && e < 2) ei[ei.length - 1] = d + 1;
                  break;
                }

                if (data.token[c] === '.') e = e + 1;

              }

              c = c + 1;

            } while (c < b);
          }
        }

        if (ctoke === '!' || ctoke === '...') {
          if (ltoke === '}' || ltoke === 'x}') level[a - 1] = indent;
          level.push(-20);
          return;
        }

        if (ltoke === ';' || ltoke === 'x;') {
          if (data.token[data.begin[a] - 1] !== 'for') level[a - 1] = indent;
          level.push(-20);
          return;
        }

        if (ctoke === '*') {

          if (ltoke === 'function' || ltoke === 'yield') {
            level[a - 1] = -20;
          } else {
            level[a - 1] = -10;
          }

          level.push(-10);
          return;
        }

        if (ctoke === '?') {

          if (
            data.lines[a] === 0 &&
            data.types[a - 2] === 'word' &&
            data.token[a - 2] !== 'return' &&
            data.token[a - 2] !== 'in' &&
            data.token[a - 2] !== 'instanceof' &&
            data.token[a - 2] !== 'typeof' && (
              ltype === 'reference' ||
              ltype === 'word'
            )
          ) {

            if (
              data.types[a + 1] === 'word' ||
              data.types[a + 1] === 'reference' || (
                (
                  data.token[a + 1] === '(' ||
                  data.token[a + 1] === 'x('
                ) &&
                data.token[a - 2] === 'new'
              )
            ) {

              level[a - 1] = -20;

              if (
                data.types[a + 1] === 'word' ||
                data.types[a + 1] === 'reference') {
                level.push(-10);
                return;
              }

              level.push(-20);
              return;
            }
          }

          if (data.token[a + 1] === ':') {
            level[a - 1] = -20;
            level.push(-20);
            return;
          }

          ternary.push(a);

          if (options.ternaryLine === true) {
            level[a - 1] = -10;
          } else {

            let c = a - 1;

            do { c = c - 1; } while (c > -1 && level[c] < -9);

            ei.push(a);
            indent = indent + 1;

            if (level[c] === indent && data.token[c + 1] !== ':') {
              indent = indent + 1;
              ei.push(a);
            }

            level[a - 1] = indent;

            if (data.token[data.begin[a]] === '(' && (ei.length < 2 || ei[0] === ei[1])) {

              destruct[destruct.length - 1] = false;

              if (a - 2 === data.begin[a]) {
                level[data.begin[a]] = indent - 1;
              } else {
                level[data.begin[a]] = indent;
              }

              c = a - 2;

              do {

                if (data.types[c] === 'end' && level[c - 1] > -1) break;
                if (level[c] > -1) level[c] = level[c] + 1;

                c = c - 1;

              } while (c > data.begin[a]);
            }
          }

          level.push(-10);
          return;
        }

        if (ctoke === ':') {
          if (
            data.stack[a] === 'map' ||
            data.types[a + 1] === 'type' ||
            data.types[a + 1] === 'type_start'
          ) {
            level[a - 1] = -20;
            level.push(-10);
            return;
          }

          if (
            ternary.length > 0 &&
            data.begin[ternary[ternary.length - 1]] === data.begin[a]
          ) {

            let c = a;
            const d = data.begin[a];

            do {

              c = c - 1;

              if (data.begin[c] === d) {

                if (data.token[c] === ',' || data.token[c] === ';') {
                  level[a - 1] = -20;
                  break;
                }

                if (data.token[c] === '?') {
                  ternary.pop();
                  endExtraInd();

                  if (options.ternaryLine === true) level[a - 1] = -10;

                  level.push(-10);
                  return;
                }

              } else if (data.types[c] === 'end') {
                c = data.begin[c];
              }

            } while (c > d);
          }

          if (
            data.token[a - 2] === 'where' &&
            data.stack[a - 2] === data.stack[a]
          ) {
            level[a - 1] = -10;
            level.push(-10);
            return;
          }

          if (
            ltype === 'reference' &&
            data.token[data.begin[a]] !== '(' &&
            data.token[data.begin[a]] !== 'x('
          ) {
            level[a - 1] = -20;
            level.push(-10);
            return;
          }

          if (
            (
              ltoke === ')' ||
              ltoke === 'x)'
            ) && data.token[data.begin[a - 1] - 2] === 'function'
          ) {
            level[a - 1] = -20;
            level.push(-10);
            return;
          }

          if (data.stack[a] === 'attribute') {
            level[a - 1] = -20;
            level.push(-10);
            return;
          }

          if (
            data.token[data.begin[a]] !== '(' &&
            data.token[data.begin[a]] !== 'x(' && (
              ltype === 'reference' ||
              ltoke === ')' ||
              ltoke === ']' ||
              ltoke === '?'
            ) && (
              data.stack[a] === 'map' ||
              data.stack[a] === 'class' ||
              data.types[a + 1] === 'reference'
            ) && (
              ternary.length === 0 ||
              ternary[ternary.length - 1] < data.begin[a]
            ) && (
              'mapclassexpressionmethodglobalparen'.indexOf(data.stack[a]) > -1 || (
                data.types[a - 2] === 'word' && data.stack[a] !== 'switch'
              )
            )
          ) {
            level[a - 1] = -20;
            level.push(-10);
            return;
          }

          if (
            data.stack[a] === 'switch' && (
              ternary.length < 1 ||
              ternary[ternary.length - 1] < data.begin[a]
            )
          ) {

            level[a - 1] = -20;

            if (options.caseSpace === true) {
              level.push(-10);
            } else {
              level.push(indent);
            }

            return;
          }

          if (data.stack[a] === 'object') {
            level[a - 1] = -20;
          } else if (ternary.length > 0) {
            level[a - 1] = indent;
          } else {
            level[a - 1] = -10;
          }

          level.push(-10);
          return;
        }

        if (ctoke === '++' || ctoke === '--') {

          if (ltype === 'number' || ltype === 'reference') {

            level[a - 1] = -20;
            level.push(-10);

          } else if (
            a < b - 1 && (
              data.types[a + 1] === 'number' ||
              data.types[a + 1] === 'reference'
            )
          ) {
            level.push(-20);
          } else {
            level.push(-10);
          }

          return;
        }

        if (ctoke === '+') {

          if (ltype === 'start') {
            level[a - 1] = -20;
          } else {
            level[a - 1] = -10;
          }

          if (options.wrap < 1 || data.token[data.begin[a]] === 'x(') {
            level.push(-10);
            return;
          }

          const aa = data.token[a + 1];

          if (aa === undefined) {
            level.push(-10);
            return;
          }

          if (data.types[a - 1] === 'operator' || data.types[a - 1] === 'start') {

            if (data.types[a + 1] === 'reference' || aa === '(' || aa === '[') {
              level.push(-20);
              return;
            }

            if (
              Number(aa.slice(1, -1)) > -1 && (
                (/\d/).test(aa.charAt(1)) === true ||
                aa.charAt(1) === '.' ||
                aa.charAt(1) === '-' ||
                aa.charAt(1) === '+'
              )
            ) {

              level.push(-20);
              return;
            }
          }

          return opWrap();
        }

        if (data.types[a - 1] !== 'comment') {

          if (ltoke === '(') {
            level[a - 1] = -20;
          } else if (
            ctoke === '*' &&
            data.stack[a] === 'object' &&
            data.types[a + 1] === 'reference' && (
              ltoke === '{' ||
              ltoke === ','
            )
          ) {

            level[a - 1] = indent;
          } else if (ctoke !== '?' || ternary.length === 0) {
            level[a - 1] = -10;
          }
        }

        if (
          ctoke.indexOf('=') > -1 &&
          ctoke !== '==' &&
          ctoke !== '===' &&
          ctoke !== '!=' &&
          ctoke !== '!==' &&
          ctoke !== '>=' &&
          ctoke !== '<=' &&
          ctoke !== '=>' &&
          data.stack[a] !== 'method' &&
          data.stack[a] !== 'object'
        ) {

          let c = a + 1;
          let d = 0;
          let e = false;
          let f = '';

          if ((
            data.token[data.begin[a]] === '(' ||
            data.token[data.begin[a]] === 'x(') &&
            data.token[a + 1] !== 'function'
          ) {
            return;
          }

          do {

            if (data.types[c] === 'start') {

              if (e === true && data.token[c] !== '[') {
                if (assignlist[assignlist.length - 1] === true) {
                  assignlist[assignlist.length - 1] = false;
                }

                break;
              }

              d = d + 1;
            }

            if (data.types[c] === 'end') d = d - 1;

            if (d < 0) {

              if (assignlist[assignlist.length - 1] === true) {
                assignlist[assignlist.length - 1] = false;
              }
              break;
            }

            if (d === 0) {

              f = data.token[c];

              if (e === true) {

                if (
                  data.types[c] === 'operator' ||
                  data.token[c] === ';' ||
                  data.token[c] === 'x;' ||
                  data.token[c] === '?' ||
                  data.token[c] === 'var' ||
                  data.token[c] === 'let' ||
                  data.token[c] === 'const'
                ) {

                  if (
                    f !== undefined && (
                      f === '?' || (
                        f.indexOf('=') > -1 &&
                        f !== '==' &&
                        f !== '===' &&
                        f !== '!=' &&
                        f !== '!==' &&
                        f !== '>=' &&
                        f !== '<='
                      )
                    )
                  ) {

                    if (assignlist[assignlist.length - 1] === false) {
                      assignlist[assignlist.length - 1] = true;
                    }
                  }

                  if (
                    (
                      f === ';' ||
                      f === 'x;' ||
                      f === 'var' ||
                      f === 'let' ||
                      f === 'const'
                    ) &&
                    assignlist[assignlist.length - 1] === true
                  ) {
                    assignlist[assignlist.length - 1] = false;
                  }

                  break;
                }

                if (
                  assignlist[assignlist.length - 1] === true && (
                    f === 'return' ||
                    f === 'break' ||
                    f === 'continue' ||
                    f === 'throw'
                  )
                ) {

                  assignlist[assignlist.length - 1] = false;
                }
              }

              if (f === ';' || f === 'x;' || f === ',') e = true;

            }

            c = c + 1;

          } while (c < b);

          level.push(-10);
          return;
        }

        if (
          (
            ctoke === '-' &&
            ltoke === 'return'
          ) ||
          ltoke === '='
        ) {
          level.push(-20);
          return;
        }

        if (
          ltype === 'operator' &&
          data.types[a + 1] === 'reference' &&
          ltoke !== '--' &&
          ltoke !== '++' &&
          ctoke !== '&&' &&
          ctoke !== '||'
        ) {

          level.push(-20);
          return;
        }

        return opWrap();

      };

      function reference () {

        // beautify_script_level_reference_hoist
        const hoist = () => {

          let func = data.begin[a];

          if (func < 0) {
            scopes.push([ data.token[a], -1 ]);
          } else {

            if (data.stack[func + 1] !== 'function') {
              do {
                func = data.begin[func];
              } while (func > -1 && data.stack[func + 1] !== 'function');
            }

            scopes.push([ data.token[a], func ]);
          }
        };

        if (data.types[a - 1] === 'comment') {

          level[a - 1] = indent;

        } else if (
          ltype === 'end' &&
          ltoke !== ')' && data.token[data.begin[a - 1] - 1] !== ')'
        ) {

          level[a - 1] = -10;

        } else if (
          ltype !== 'separator' &&
          ltype !== 'start' &&
          ltype !== 'end' && ltype.indexOf('template_string') < 0) {

          if (
            ltype === 'word' ||
            ltype === 'operator' ||
            ltype === 'property' ||
            ltype === 'type' ||
            ltype === 'reference'
          ) {
            level[a - 1] = -10;
          } else {
            level[a - 1] = -20;
          }
        }

        if (ltoke === 'var' && data.lexer[a - 1] === lexer) {
          // hoisted references following declaration keyword
          hoist();

        } else if (ltoke === 'function') {

          scopes.push([ data.token[a], a ]);

        } else if (ltoke === 'let' || ltoke === 'const') {

          // not hoisted references following declaration keyword
          scopes.push([ data.token[a], a ]);

        } else if (data.stack[a] === 'arguments') {

          scopes.push([ data.token[a], a ]);
        } else if (ltoke === ',') {

          // references following a comma, must be tested to see if a declaration list
          let index = a;

          do {
            index = index - 1;
          } while (
            index > data.begin[a] &&
            data.token[index] !== 'var' &&
            data.token[index] !== 'let' &&
            data.token[index] !== 'const'
          );

          if (data.token[index] === 'var') {
            hoist();
          } else if (data.token[index] === 'let' || data.token[index] === 'const') {
            scopes.push([ data.token[a], a ]);
          }
        }

        level.push(-10);

      };

      function separator () {

        const ei = (extraindent[extraindent.length - 1] === undefined)
          ? []
          : extraindent[extraindent.length - 1];

        // beautify_script_level_separator_propertybreak
        function propertybreak () {

          if (options.methodChain > 0) {

            let x = a;
            let y = data.begin[a];

            const z = [ a ];
            const ify = (data.token[y - 1] === 'if');

            do {

              x = x - 1;

              if (data.types[x] === 'end') x = data.begin[x];
              if (data.begin[x] === y) {

                if (
                  data.types[x] === 'string' &&
                  data.token[x].indexOf('${') === data.token[x].length - 2) {
                  break;
                }

                if (data.token[x] === '.') {

                  if (level[x - 1] > 0) {
                    level[a - 1] = (ify === true) ? indent + 1 : indent;
                    return;
                  }

                  z.push(x);

                } else if (
                  data.token[x] === ';' ||
                  data.token[x] === ',' ||
                  data.types[x] === 'operator' || (
                    (
                      data.types[x] === 'word' ||
                      data.types[x] === 'reference'
                    ) && (
                      data.types[x - 1] === 'word' ||
                      data.types[x - 1] === 'reference'
                    )
                  )
                ) {
                  break;
                }
              }

            } while (x > y);

            if (z.length < options.methodChain) {
              level[a - 1] = -20;
              return;
            }

            x = 0;
            y = z.length;

            do {
              level[z[x] - 1] = (ify === true) ? indent + 1 : indent;
              x = x + 1;
            } while (x < y);

            x = z[z.length - 1] - 1;

            do {

              if (level[x] > -1) level[x] = level[x] + 1;

              x = x + 1;

            } while (x < a);

            indent = (ify === true) ? indent + 2 : indent + 1;
          }

          level[a - 1] = indent;

        };

        if (ctoke === '::') {
          level[a - 1] = -20;
          level.push(-20);
          return;
        }

        if (ctoke === '.') {

          if (
            data.token[data.begin[a]] !== '(' &&
            data.token[data.begin[a]] !== 'x(' &&
            ei.length > 0
          ) {

            if (data.stack[a] === 'object' || data.stack[a] === 'array') {
              destructfix(true, false);
            } else {
              destructfix(false, false);
            }
          }

          if (options.methodChain === 0) {
            // methodchain is 0 so methods and properties should be chained together
            level[a - 1] = -20;
          } else if (options.methodChain < 0) {

            if (data.lines[a] > 0) {
              propertybreak();
            } else {
              level[a - 1] = -20;
            }
          } else {
            // methodchain is greater than 0 and should break
            // methods if the chain reaches this value
            propertybreak();
          }

          level.push(-20);
          return;
        }

        if (ctoke === ',') {

          fixchain();

          if (
            list[list.length - 1] === false && (
              data.stack[a] === 'object' ||
              data.stack[a] === 'array' ||
              data.stack[a] === 'paren' ||
              data.stack[a] === 'expression' ||
              data.stack[a] === 'method'
            )
          ) {

            list[list.length - 1] = true;

            if (data.token[data.begin[a]] === '(') {

              let aa = a;

              do {

                aa = aa - 1;

                if (
                  data.begin[aa] === data.begin[a] &&
                  data.token[aa] === '+' && level[aa] > -9
                ) {
                  level[aa] = level[aa] + 2;
                }

              } while (aa > data.begin[a]);
            }
          }

          if (data.stack[a] === 'array' && options.arrayFormat === 'indent') {
            level[a - 1] = -20;
            level.push(indent);
            return;
          }

          if (data.stack[a] === 'array' && options.arrayFormat === 'inline') {
            level[a - 1] = -20;
            level.push(-10);
            return;
          }

          if (data.stack[a] === 'object' && options.objectIndent === 'indent') {
            level[a - 1] = -20;
            level.push(indent);
            return;
          }

          if (data.stack[a] === 'object' && options.objectIndent === 'inline') {
            level[a - 1] = -20;
            level.push(-10);
            return;
          }

          if (ei.length > 0) {

            if (ei[ei.length - 1] > -1) endExtraInd();

            level[a - 1] = -20;
            level.push(indent);
            return;
          }

          if (data.token[a - 2] === ':' && data.token[a - 4] === 'where') {
            level[a - 1] = -20;
            level.push(-10);
            return;
          }

          level[a - 1] = -20;

          if (data.types[a + 1] !== 'end') {
            itemcount[itemcount.length - 1] = itemcount[itemcount.length - 1] + 1;
          }

          if (
            (
              data.token[data.begin[a]] === '(' ||
              data.token[data.begin[a]] === 'x('
            ) &&
            options.language !== 'jsx' &&
            data.stack[a] !== 'global' && (
              (
                data.types[a - 1] !== 'string' &&
                data.types[a - 1] !== 'number'
              ) ||
              data.token[a - 2] !== '+' || (
                data.types[a - 1] === 'string' &&
                data.types[a - 1] !== 'number' &&
                data.token[a - 2] === '+' &&
                data.types[a - 3] !== 'string' &&
                data.types[a - 3] !== 'number'
              )
            )
          ) {

            level.push(-10);
            return;
          }

          if (
            ltype === 'reference' &&
            data.types[a - 2] === 'word' &&
            'var-let-const-from'.indexOf(data.token[a - 2]) < 0 && (
              data.types[a - 3] === 'end' ||
              data.token[a - 3] === ';'
            )
          ) {

            wordlist[wordlist.length - 1] = true;
            level.push(-10);
            return;
          }

          if (wordlist[wordlist.length - 1] === true || data.stack[a] === 'notation') {
            level.push(-10);
            return;
          }

          if (
            itemcount[itemcount.length - 1] > 3 && (
              data.stack[a] === 'array' ||
              data.stack[a] === 'object'
            )
          ) {

            if (destruct[destruct.length - 1] === true) destructfix(true, true);

            level[a - 1] = -20;

            if (arrbreak[arrbreak.length - 1] === true) {
              level.push(indent);
              return;
            }

            const begin = data.begin[a];
            let c = a;

            do {

              if (data.types[c] === 'end') {
                c = data.begin[c];
              } else {
                if (data.token[c] === ',' && data.types[c + 1] !== 'comment') {
                  level[c] = indent;
                }
              }

              c = c - 1;

            } while (c > begin);

            level[begin] = indent;
            arrbreak[arrbreak.length - 1] = true;

            return;
          }

          if (data.stack[a] === 'object') {

            if (
              destruct[destruct.length - 1] === true &&
              data.types[data.begin[a] - 1] !== 'word' &&
              data.types[data.begin[a] - 1] !== 'reference' &&
              data.token[data.begin[a] - 1] !== '(' &&
              data.token[data.begin[a] - 1] !== 'x('
            ) {

              const bb = data.begin[a];
              let aa = a - 1;

              do {
                if (data.begin[aa] === bb) {

                  if (data.token[aa] === ',') break;
                  if (data.token[aa] === ':') {
                    destructfix(true, false);
                    break;
                  }
                }

                aa = aa - 1;

              } while (aa > bb);
            }
          }

          if (
            destruct[destruct.length - 1] === false || (
              data.token[a - 2] === '+' && (
                ltype === 'string' ||
                ltype === 'number'
              ) &&
              level[a - 2] > 0 && (
                ltoke.charAt(0) === '"' ||
                ltoke.charAt(0) === "'"
              )
            )
          ) {

            if (data.stack[a] === 'method') {
              if (
                data.token[a - 2] === '+' && (
                  ltoke.charAt(0) === '"' ||
                  ltoke.charAt(0) === "'"
                ) && (
                  data.token[a - 3].charAt(0) === '"' ||
                  data.token[a - 3].charAt(0) === "'"
                )
              ) {
                level.push(indent + 2);
                return;
              }

              if (data.token[a - 2] !== '+') {
                level.push(-10);
                return;
              }
            }

            level.push(indent);
            return;
          }

          if (destruct[destruct.length - 1] === true && data.stack[a] !== 'object') {
            level.push(-10);
            return;
          }

          if (
            itemcount[itemcount.length - 1] < 4 && (
              data.stack[a] === 'array' ||
              data.stack[a] === 'object'
            )
          ) {
            level.push(-10);
            return;
          }

          level.push(indent);
          return;
        }

        if (ctoke === ';' || ctoke === 'x;') {

          fixchain();

          if (
            data.token[a + 1] !== undefined &&
            data.types[a + 1].indexOf('attribute') > 0 &&
            data.types[a + 1].indexOf('end') > 0
          ) {
            level[a - 1] = -20;
            level.push(indent - 1);
            return;
          }

          if (
            varindex[varindex.length - 1] > -1 &&
            data.stack[varindex[varindex.length - 1]] !== 'expression'
          ) {

            let aa = a;

            do {

              aa = aa - 1;

              if (data.token[aa] === ';') break;

              if (data.token[aa] === ',') {
                indent = indent - 1;
                break;
              }

              if (data.types[aa] === 'end') aa = data.begin[aa];

            } while (aa > 0 && aa > data.begin[a]);
          }

          varindex[varindex.length - 1] = -1;

          endExtraInd();

          if (data.token[data.begin[a] - 1] !== 'for') destructfix(false, false);
          if (ctoke === 'x;') scolon = scolon + 1;

          wordlist[wordlist.length - 1] = false;
          level[a - 1] = -20;

          if (
            data.begin[a] > 0 &&
            data.token[data.begin[a] - 1] === 'for' &&
            data.stack[a] !== 'for'
          ) {
            level.push(-10);
            return;
          }

          level.push(indent);
          return;
        }

        level.push(-20);
      };

      function start () {

        const deep = data.stack[a + 1];
        const deeper = (a === 0) ? data.stack[a] : data.stack[a - 1];

        if (
          ltoke === ')' || (
            (
              deeper === 'object' ||
              deeper === 'array'
            ) && ltoke !== ']'
          )
        ) {

          if (
            deep !== 'method' || (
              deep === 'method' &&
              data.token[a + 1] !== ')' &&
              data.token[a + 2] !== ')'
            )
          ) {

            if (
              ltoke === ')' && (
                deep !== 'function' ||
                data.token[data.begin[data.begin[a - 1] - 1]] === '(' ||
                data.token[data.begin[data.begin[a - 1] - 1]] === 'x('
              )
            ) {

              destructfix(false, false);
            } else if (data.types[a + 1] !== 'end' && data.types[
              a + 2] !== 'end') {
              destructfix(true, false);
            }
          }
        }

        list.push(false);
        extraindent.push([]);
        assignlist.push(false);
        arrbreak.push(false);
        wordlist.push(false);
        itemcount.push(0);

        if (
          options.neverFlatten === true || (
            deep === 'array' &&
            options.arrayFormat === 'indent'
          ) ||
          deep === 'attribute' ||
          ltype === 'generic' || (
            deep === 'class' &&
            ltoke !== '(' &&
            ltoke !== 'x('
          ) || (
            ctoke === '[' &&
            data.token[a + 1] === 'function'
          )
        ) {
          destruct.push(false);
        } else {

          if (deep === 'expression' || deep === 'method') {
            destruct.push(true);

          } else if (
            (
              deep === 'object' ||
              deep === 'class'
            ) && (
              ltoke === '(' ||
              ltoke === 'x(' ||
              ltype === 'word' ||
              ltype === 'reference'
            )
          ) {
            // array or object literal following `return` or `(`
            destruct.push(true);
          } else if (deep === 'array' || ctoke === '(' || ctoke === 'x(') {
            // array, method, paren
            destruct.push(true);

          } else if (
            ctoke === '{' &&
            deep === 'object' &&
            ltype !== 'operator' &&
            ltype !== 'start' &&
            ltype !== 'string' &&
            ltype !== 'number' &&
            deeper !== 'object' &&
            deeper !== 'array' &&
            a > 0
          ) {
            // curly brace not in a list and not assigned
            destruct.push(true);
          } else {
            // not destructured (multiline)
            destruct.push(false);
          }
        }
        if (ctoke !== '(' && ctoke !== 'x(' && data.stack[a + 1] !== 'attribute') {
          indent = indent + 1;
        }

        if (ctoke === '{' || ctoke === 'x{') {

          varindex.push(-1);

          if (data.types[a - 1] !== 'comment') {

            if (ltype === 'markup' as any) {
              level[a - 1] = indent;

            } else if (
              options.braceAllman === true &&
              ltype !== 'operator' &&
              ltoke !== 'return'
            ) {

              level[a - 1] = indent - 1;

            } else if (
              data.stack[a + 1] !== 'block' && (
                deep === 'function' ||
                ltoke === ')' ||
                ltoke === 'x)' ||
                ltoke === ',' ||
                ltoke === '}' ||
                ltype === 'markup' as any
              )
            ) {
              level[a - 1] = -10;

            } else if (
              ltoke === '{' ||
              ltoke === 'x{' ||
              ltoke === '[' ||
              ltoke === '}' ||
              ltoke === 'x}'
            ) {
              level[a - 1] = indent - 1;
            }
          }

          if (deep === 'object') {

            if (options.objectIndent === 'indent') {
              destruct[destruct.length - 1] = false;
              level.push(indent);
              return;
            }

            if (options.objectIndent === 'inline') {
              destruct[destruct.length - 1] = true;
              level.push(-20);
              return;
            }
          }

          if (deep === 'switch') {

            if (options.noCaseIndent === true) {
              level.push(indent - 1);
              return;
            }

            indent = indent + 1;
            level.push(indent);
            return;
          }

          if (destruct[destruct.length - 1] === true) {
            if (ltype !== 'word' && ltype !== 'reference') {
              level.push(-20);
              return;
            }
          }

          level.push(indent);
          return;
        }

        if (ctoke === '(' || ctoke === 'x(') {

          if (options.wrap > 0 && ctoke === '(' && data.token[a + 1] !== ')') {
            count.push(1);
          }

          if (ltoke === '-' && (data.token[a - 2] === '(' || data.token[a - 2] === 'x(')) {
            level[a - 2] = -20;
          }

          if (
            ltype === 'end' &&
            deeper !== 'if' &&
            deeper !== 'for' &&
            deeper !== 'catch' &&
            deeper !== 'else' &&
            deeper !== 'do' &&
            deeper !== 'try' &&
            deeper !== 'finally' &&
            deeper !== 'catch'
          ) {

            if (data.types[a - 1] === 'comment') {
              level[a - 1] = indent;
            } else {
              level[a - 1] = -20;
            }
          }

          if (ltoke === 'async') {

            level[a - 1] = -10;

          } else if (
            deep === 'method' || (
              data.token[a - 2] === 'function' &&
              ltype === 'reference'
            )
          ) {

            if (
              ltoke === 'import' ||
              ltoke === 'in' ||
              options.functionNameSpace === true
            ) {
              level[a - 1] = -10;

            } else if (
              (
                ltoke === '}' &&
                data.stack[a - 1] === 'function'
              ) ||
              ltype === 'word' ||
              ltype === 'reference' ||
              ltype === 'property'
            ) {

              level[a - 1] = -20;

            } else if (deeper !== 'method' && deep !== 'method') {
              level[a - 1] = indent;
            }
          }

          if (
            ltoke === '+' && (
              data.token[a - 2].charAt(0) === '"' ||
              data.token[a - 2].charAt(0) === "'"
            )
          ) {
            level.push(indent);
            return;
          }

          if (ltoke === '}' || ltoke === 'x}') {
            level.push(-20);
            return;
          }

          if (
            (
              ltoke === '-' && (
                a < 2 || (
                  data.token[a - 2] !== ')' &&
                  data.token[a - 2] !== 'x)' &&
                  data.token[a - 2] !== ']' &&
                  data.types[a - 2] !== 'reference' &&
                  data.types[a - 2] !== 'string' &&
                  data.types[a - 2] !== 'number'
                )
              )
            ) || (
              options.functionSpace === false &&
              ltoke === 'function'
            )
          ) {
            level[a - 1] = -20;
          }

          level.push(-20);
          return;
        }

        if (ctoke === '[') {

          if (ltoke === '[') list[list.length - 2] = true;

          if (
            ltoke === 'return' ||
            ltoke === 'var' ||
            ltoke === 'let' ||
            ltoke === 'const'
          ) {

            level[a - 1] = -10;

          } else if (
            data.types[a - 1] !== 'comment' &&
            data.stack[a - 1] !== 'attribute' && (
              ltype === 'end' ||
              ltype === 'word' ||
              ltype === 'reference'
            )
          ) {

            level[a - 1] = -20;

          } else if (ltoke === '[' || ltoke === '{' || ltoke === 'x{') {
            level[a - 1] = indent - 1;
          }

          if (data.stack[a] === 'attribute') {
            level.push(-20);
            return;
          }

          if (options.arrayFormat === 'indent') {
            destruct[destruct.length - 1] = false;
            level.push(indent);
            return;
          }

          if (options.arrayFormat === 'inline') {
            destruct[destruct.length - 1] = true;
            level.push(-20);
            return;
          }

          if (deep === 'method' || destruct[destruct.length - 1] === true) {
            level.push(-20);
            return;
          }

          let c = a + 1;

          do {

            if (data.token[c] === ']') {
              level.push(-20);
              return;
            }

            if (data.token[c] === ',') {
              level.push(indent);
              return;
            }

            c = c + 1;

          } while (c < b);

          level.push(-20);

        }
      };

      function string () {

        if (ctoke.length === 1) {

          level.push(-20);

          if (data.lines[a] === 0) level[a - 1] = -20;

        } else if (ctoke.indexOf('#!/') === 0) {

          level.push(indent);
        } else {

          level.push(-10);
        }

        if (
          (
            ltoke === ',' ||
            ltype === 'start'
          ) && (
            data.stack[a] === 'object' ||
            data.stack[a] === 'array'
          ) &&
          destruct[destruct.length - 1] === false && a > 0
        ) {

          level[a - 1] = indent;
        }
      };

      function template () {

        if (ctype === 'template_else') {
          level[a - 1] = indent - 1;
          level.push(indent);

        } else if (ctype === 'template_start') {

          indent = indent + 1;

          if (data.lines[a - 1] < 1) level[a - 1] = -20;

          // eslint-disable-next-line no-mixed-operators
          if (data.lines[a] > 0 || ltoke.length === 1 && ltype === 'string') {
            level.push(indent);
          } else {
            level.push(-20);
          }

        } else if (ctype === 'template_end') {

          indent = indent - 1;

          if (ltype === 'template_start' || data.lines[a - 1] < 1) {
            level[a - 1] = -20;
          } else {
            level[a - 1] = indent;
          }

          if (data.lines[a] > 0) {
            level.push(indent);
          } else {
            level.push(-20);
          }

        } else if (ctype === 'template') {
          if (data.lines[a] > 0) {
            level.push(indent);
          } else {
            level.push(-20);
          }
        }
      };

      function templateString () {

        if (ctype === 'template_string_start') {
          indent = indent + 1;
          level.push(indent);

        } else if (ctype === 'template_string_else') {
          fixchain();
          level[a - 1] = indent - 1;
          level.push(indent);
        } else {
          fixchain();
          indent = indent - 1;
          level[a - 1] = indent;
          level.push(-10);
        }

        if (
          a > 2 && (
            data.types[a - 2] === 'template_string_else' ||
            data.types[a - 2] === 'template_string_start'
          )
        ) {

          if (options.bracePadding === true) {
            level[a - 2] = -10;
            level[a - 1] = -10;
          } else {
            level[a - 2] = -20;
            level[a - 1] = -20;
          }
        }
      };

      function types () {

        if (
          data.token[a - 1] === ',' || (
            data.token[a - 1] === ':' &&
            data.stack[a - 1] !== 'data_type'
          )
        ) {
          level[a - 1] = -10;
        } else {
          level[a - 1] = -20;
        }

        if (data.types[a] === 'type' || data.types[a] === 'type_end') {
          level.push(-10);
        }

        if (data.types[a] === 'type_start') {
          level.push(-20);
        }

      };

      function word () {

        if (
          (
            ltoke === ')' ||
            ltoke === 'x)'
          ) &&
          data.stack[a] === 'class' && (
            data.token[data.begin[a - 1] - 1] === 'static' ||
            data.token[data.begin[a - 1] - 1] === 'final' ||
            data.token[data.begin[a - 1] - 1] === 'void'
          )
        ) {
          level[a - 1] = -10;
          level[data.begin[a - 1] - 1] = -10;
        }

        if (
          options.ifReturnInline === true &&
          data.stack[a] === 'if' &&
          ctoke === 'return' &&
          data.token[a - 2] === ')' &&
          ltoke !== '{'
        ) {
          level[a - 1] = -20;
        }

        if (ltoke === ']') level[a - 1] = -10;
        if (ltoke === '}' || ltoke === 'x}') {
          level[a - 1] = indent - 1;

        }
        if (ctoke === 'else' && ltoke === '}') {
          if (data.token[a - 2] === 'x}') level[a - 3] = level[a - 3] - 1;
          if (options.braceAllman === true) level[a - 1] = indent;
        }

        if (ctoke === 'new') {

          const apiword = [
            'ActiveXObject',
            'ArrayBuffer',
            'AudioContext',
            'Canvas',
            'CustomAnimation',
            'DOMParser',
            'DataView',
            'Date',
            'Error',
            'EvalError',
            'FadeAnimation',
            'FileReader',
            'Flash',
            'Float32Array',
            'Float64Array',
            'FormField',
            'Frame',
            'Generator',
            'HotKey',
            'Image',
            'Iterator',
            'Intl',
            'Int16Array',
            'Int32Array',
            'Int8Array',
            'InternalError',
            'Loader',
            'Map',
            'MenuItem',
            'MoveAnimation',
            'Notification',
            'ParallelArray',
            'Point',
            'Promise',
            'Proxy',
            'RangeError',
            'Rectangle',
            'ReferenceError',
            'Reflect',
            'RegExp',
            'ResizeAnimation',
            'RotateAnimation',
            'Set',
            'SQLite',
            'ScrollBar',
            'Set',
            'Shadow',
            'StopIteration',
            'Symbol',
            'SyntaxError',
            'Text',
            'TextArea',
            'Timer',
            'TypeError',
            'URL',
            'Uint16Array',
            'Uint32Array',
            'Uint8Array',
            'Uint8ClampedArray',
            'URIError',
            'WeakMap',
            'WeakSet',
            'Web',
            'Window',
            'XMLHttpRequest'
          ];

          if (apiword.indexOf(data.token[a + 1]) < 0) news = news + 1;

        }

        if (
          ctoke === 'from' &&
          ltype === 'end' &&
          a > 0 && (
            data.token[data.begin[a - 1] - 1] === 'import' ||
            data.token[data.begin[a - 1] - 1] === ','
          )
        ) {
          level[a - 1] = -10;
        }

        if (ctoke === 'function') {

          if (
            options.functionSpace === false &&
            a < b - 1 && (
              data.token[a + 1] === '(' ||
              data.token[a + 1] === 'x('
            )
          ) {
            level.push(-20);
            return;
          }

          level.push(-10);
          return;
        }

        if (ltoke === '-' && a > 1) {

          if (data.types[a - 2] === 'operator' || data.token[a - 2] === ',') {
            level[a - 1] = -20;
          } else if (data.types[a - 2] === 'start') {
            level[a - 2] = -20;
            level[a - 1] = -20;
          }

        } else if (ctoke === 'while' && (ltoke === '}' || ltoke === 'x}')) {

          // verify if this is a do/while block
          let c = a - 1;
          let d = 0;

          do {

            if (data.token[c] === '}' || data.token[c] === 'x}') d = d + 1;
            if (data.token[c] === '{' || data.token[c] === 'x{') d = d - 1;
            if (d === 0) {

              if (data.token[c - 1] === 'do') {
                level[a - 1] = -10;
                break;
              }

              level[a - 1] = indent;
              break;
            }

            c = c - 1;

          } while (c > -1);

        } else if (
          ctoke === 'in' || (
            (
              (
                ctoke === 'else' &&
                options.elseNewline === false &&
                options.braceAllman === false
              ) ||
              ctoke === 'catch'
            ) && (
              ltoke === '}' ||
              ltoke === 'x}'
            )
          )
        ) {

          level[a - 1] = -10;

        } else if (
          ctoke === 'var' ||
          ctoke === 'let' ||
          ctoke === 'const'
        ) {

          varindex[varindex.length - 1] = a;

          if (ltype === 'end') level[a - 1] = indent;
          if (data.token[data.begin[a] - 1] !== 'for') {

            let c = a + 1;
            let d = 0;

            do {

              if (data.types[c] === 'end') d = d - 1;
              if (data.types[c] === 'start') d = d + 1;
              if (
                d < 0 || (
                  d === 0 && (
                    data.token[c] === ';' ||
                    data.token[c] === ','
                  )
                )
              ) {
                break;
              }

              c = c + 1;

            } while (c < b);

            if (data.token[c] === ',') indent = indent + 1;

          }

          level.push(-10);

          return;
        }

        if (
          (
            ctoke === 'default' ||
            ctoke === 'case'
          ) && ltype !== 'word' && data.stack[a] === 'switch'
        ) {
          level[a - 1] = indent - 1;
          level.push(-10);
          return;
        }

        if (ctoke === 'catch' && ltoke === '.') {
          level[a - 1] = -20;
          level.push(-20);
          return;
        }

        if (ctoke === 'catch' || ctoke === 'finally') {
          level[a - 1] = -10;
          level.push(-10);
          return;
        }

        if (
          options.bracePadding === false &&
          a < b - 1 &&
          data.token[a + 1].charAt(0) === '}'
        ) {
          level.push(-20);
          return;
        }

        if (
          data.stack[a] === 'object' && (
            ltoke === '{' ||
            ltoke === ','
          ) && (
            data.token[a + 1] === '(' ||
            data.token[a + 1] === 'x('
          )
        ) {
          level.push(-20);
          return;
        }

        if (
          data.types[a - 1] === 'comment' &&
          data.token[data.begin[a]] === '('
        ) {
          level[a - 1] = indent + 1;
        }

        level.push(-10);
      };

      do {

        if (data.lexer[a] === lexer) {

          ctype = data.types[a];
          ctoke = data.token[a];

          if (ctype === 'comment') {
            comment();
          } else if (ctype === 'regex') {
            level.push(-20);
          } else if (ctype === 'string') {
            string();
          } else if (ctype.indexOf('template_string') === 0) {
            templateString();
          } else if (ctype === 'separator') {
            separator();
          } else if (ctype === 'start') {
            start();
          } else if (ctype === 'end') {
            end();
          } else if (ctype === 'type' || ctype === 'type_start' || ctype === 'type_end') {
            types();
          } else if (ctype === 'operator') {
            operator();
          } else if (ctype === 'word') {
            word();
          } else if (ctype === 'reference') {
            reference();
          } else if (ctype === 'markup') {
            markup();
          } else if (ctype.indexOf('template') === 0) {
            template();
          } else if (ctype === 'generic') {

            if (
              ltoke !== 'return' &&
              ltoke.charAt(0) !== '#' &&
              ltype !== 'operator' &&
              ltoke !== 'public' &&
              ltoke !== 'private' &&
              ltoke !== 'static' &&
              ltoke !== 'final' &&
              ltoke !== 'implements' &&
              ltoke !== 'class' &&
              ltoke !== 'void'
            ) {
              level[a - 1] = -20;
            }

            if (data.token[a + 1] === '(' || data.token[a + 1] === 'x(') {
              level.push(-20);
            } else {
              level.push(-10);
            }

          } else {
            level.push(-10);
          }

          if (ctype !== 'comment') {
            ltype = ctype as any;
            ltoke = ctoke;
          }

          if (count.length > 0 && data.token[a] !== ')') {

            if (data.types[a] === 'comment' && count[count.length - 1] > -1) {

              count[count.length - 1] = options.wrap + 1;

            } else if (
              level[a] > -1 || (
                data.token[a].charAt(0) === '`' &&
                data.token[a].indexOf('\n') > 0
              )
            ) {

              count[count.length - 1] = -1;

            } else if (count[count.length - 1] > -1) {
              count[count.length - 1] = count[count.length - 1] + data.token[a].length;
              if (level[a] === -10) count[count.length - 1] = count[count.length - 1] + 1;
            }
          }

        } else {
          external();
        }

        a = a + 1;

      } while (a < b);

      return level;

    })();

    const output = (() => {

      const build = [];

      const tab = (() => {

        const tabby = [];
        const ch = options.indentChar;
        let index = options.indentSize;

        if (typeof index !== 'number' || index < 1) return '';

        do {
          tabby.push(ch);
          index = index - 1;
        } while (index > 0);

        return tabby.join('');

      })();

      const lf = (options.crlf === true) ? '\r\n' : '\n';
      const pres = options.preserveLine + 1;
      const invisibles = [ 'x;', 'x}', 'x{', 'x(', 'x)' ];

      let a = prettydiff.start;
      let external = '';
      let lastLevel = options.indentLevel;

      function nl (tabs: number) {

        const linesout = [];
        const total = (() => {

          if (a === b - 1) return 1;
          if (data.lines[a + 1] - 1 > pres) return pres;
          if (data.lines[a + 1] > 1) return data.lines[a + 1] - 1;

          return 1;

        })();

        let index = 0;

        if (tabs < 0) tabs = 0;

        do {

          linesout.push(lf);
          index = index + 1;

        } while (index < total);

        if (tabs > 0) {

          index = 0;

          do {
            linesout.push(tab);
            index = index + 1;
          } while (index < tabs);

        }

        return linesout.join('');
      };

      if (options.vertical === true) {

        function vertical (end: number) {

          let longest = 0;
          let complex = 0;
          let aa = end - 1;
          let bb = 0;
          let cc = 0;

          const begin = data.begin[a];
          const list = [];

          do {

            if (
              (
                data.begin[aa] === begin ||
                data.token[aa] === ']' ||
                data.token[aa] === ')'
              ) && (
                (
                  data.token[aa + 1] === ':' &&
                  data.stack[aa] === 'object'
                ) || data.token[aa + 1] === '='
              )
            ) {

              bb = aa;
              complex = 0;

              do {
                if (data.begin[bb] === begin) {

                  if (
                    data.token[bb] === ',' ||
                    data.token[bb] === ';' ||
                    data.token[bb] === 'x;' || (
                      levels[bb] > -1 &&
                      data.types[bb] !== 'comment'
                    )
                  ) {

                    if (data.token[bb + 1] === '.') {
                      complex = complex + (options.indentSize * options.indentChar.length);
                    }

                    break;
                  }

                } else if (levels[bb] > -1) {

                  break;
                }

                if (data.types[bb] !== 'comment') {
                  if (levels[bb - 1] === -10) complex = complex + 1;
                  complex = data.token[bb].length + complex;
                }

                bb = bb - 1;

              } while (bb > begin);

              cc = bb;

              if (data.token[cc] === ',' && data.token[aa + 1] === '=') {

                do {

                  if (data.types[cc] === 'end') cc = data.begin[cc];
                  if (data.begin[cc] === begin) {

                    if (data.token[cc] === ';' || data.token[cc] === 'x;') break;
                    if (
                      data.token[cc] === 'var' ||
                      data.token[cc] === 'const' ||
                      data.token[cc] === 'let'
                    ) {
                      complex = complex + (options.indentSize * options.indentChar.length);
                      break;
                    }
                  }

                  cc = cc - 1;

                } while (cc > begin);
              }

              if (complex > longest) longest = complex;

              list.push([ aa, complex ]);
              aa = bb;

            } else if (data.types[aa] === 'end') {
              aa = data.begin[aa];
            }

            aa = aa - 1;

          } while (aa > begin);

          aa = list.length;

          if (aa > 0) {

            do {

              aa = aa - 1;
              bb = list[aa][1];

              if (bb < longest) {
                do {
                  data.token[list[aa][0]] = data.token[list[aa][0]] + ' ';
                  bb = bb + 1;
                } while (bb < longest);
              }

            } while (aa > 0);
          }
        };

        a = b;

        do {
          a = a - 1;
          if (data.lexer[a] === 'script') {

            if (
              data.token[a] === '}' &&
              data.token[a - 1] !== '{' &&
              levels[data.begin[a]] > 0
            ) {

              vertical(a);
            }

          } else {
            a = data.begin[a];
          }

        } while (a > 0);

      }

      a = prettydiff.start;

      do {

        if (
          data.lexer[a] === lexer ||
          prettydiff.beautify[data.lexer[a]] === undefined
        ) {

          if (invisibles.indexOf(data.token[a]) < 0) {

            if (data.token[a] !== ';' || options.noSemicolon === false) {
              build.push(data.token[a]);
            } else if (levels[a] < 0 && data.types[a + 1] !== 'comment') {
              build.push(';');
            }

          }

          if (
            a < b - 1 &&
            data.lexer[a + 1] !== lexer &&
            data.begin[a] === data.begin[a + 1] &&
            data.types[a + 1].indexOf('end') < 0 &&
            data.token[a] !== ','
          ) {

            build.push(' ');

          } else if (levels[a] > -1) {

            if (
              (
                (levels[a] > -1 && data.token[a] === '{') ||
                (levels[a] > -1 && data.token[a + 1] === '}')
              ) &&
              data.lines[a] < 3 &&
              options.braceNewline === true
            ) {

              build.push(nl(0));

            }

            build.push(nl(levels[a]));
            lastLevel = levels[a];

          } else if (levels[a] === -10) {

            build.push(' ');

            if (data.lexer[a + 1] !== lexer) lastLevel = lastLevel + 1;

          }
        } else {

          if (externalIndex[a] === a) {

            build.push(data.token[a]);

          } else {

            prettydiff.end = externalIndex[a];
            prettydiff.start = a;

            external = prettydiff.beautify[data.lexer[a]](options);

            build.push(external.replace(/\s+$/, ''));

            a = prettydiff.iterator;

            if (levels[a] === -10) {
              build.push(' ');
            } else if (levels[a] > -1) {
              build.push(nl(levels[a]));
            }

            // HOT PATCH
            // Reset indentation level, if not reset to 0 then
            // content will shift on save
            options.indentLevel = 0;
          }
        }

        a = a + 1;

      } while (a < b);

      prettydiff.iterator = b - 1;

      return build.join('');

    })();

    return output;

  };

  prettydiff.beautify.script = script;

}());
