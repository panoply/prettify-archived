# Snapshot report for `tests/rules/markup.test.mjs`

The actual snapshot is saved in `markup.test.mjs.snap`.

Generated by [AVA](https://avajs.dev).

## Attribute Sorting (Alphanumeric)

> { markup: { attributeSort: true } }

    `<div␊
      data-a="1"␊
      data-b="2"␊
      data-c="3"␊
      data-d="4"␊
      data-e="5"␊
      data-e="6"␊
      id="last">␊
    ␊
      <ul>␊
    ␊
        <li␊
          class="x"␊
          data-a="1"␊
          data-b="2"␊
          data-c="3"␊
          data-d="4"␊
          data-e="5"␊
          data-e="6"␊
          data-e="7"␊
          data-f="8"␊
          data-g="9"␊
          data-h-attr="10"␊
          data-h-b-attr="10"␊
          data-h-b-attr="11"␊
          data-i="12"␊
          id="{{ some.object }}">␊
          The attributes of this tag will be sorted␊
        </li>␊
      </ul>␊
    ␊
    </div>`

> { markup: { attributeSort: false } }

    `<div␊
      data-c="3"␊
      data-b="2"␊
      data-d="4"␊
      data-e="5"␊
      data-e="6"␊
      data-a="1"␊
      id="last">␊
    ␊
      <ul>␊
    ␊
        <li␊
          class="x"␊
          id="{{ some.object }}"␊
          data-c="3"␊
          data-b="2"␊
          data-d="4"␊
          data-f="8"␊
          data-e="5"␊
          data-g="9"␊
          data-h-attr="10"␊
          data-h-b-attr="11"␊
          data-h-b-attr="10"␊
          data-i="12"␊
          data-e="7"␊
          data-e="6"␊
          data-a="1">␊
          The attributes of this tag will be sorted␊
        </li>␊
      </ul>␊
    ␊
    </div>`

## Attribute Sort List

> {
>     markup: {
>       attributeSort: true,
>       attributeSortList: [
>         'class',
>         'data-b',
>         'data-a',
>         'data-c',
>         'data-e'
>       ]
>     }
>   }

    `<div␊
      data-b="2"␊
      data-a="1"␊
      data-c="3"␊
      data-e="5"␊
      data-d="4"␊
      data-e="6"␊
      id="last">␊
    ␊
      <div>␊
    ␊
        <p␊
          class="x"␊
          data-b="2"␊
          data-a="1"␊
          data-c="3"␊
          data-e="5"␊
          data-d="4"␊
          data-e="6"␊
          data-e="7"␊
          data-f="8"␊
          data-g="9"␊
          data-h-attr="10"␊
          data-h-b-attr="10"␊
          data-h-b-attr="12"␊
          data-i="12"␊
          id="{{ some.object }}">␊
    ␊
          <h1␊
            fifth␊
            first␊
            fourth␊
            second␊
            third></h1>␊
    ␊
        </p>␊
    ␊
      </div>␊
    </div>`

> { markup: { attributeSort: false } } (default)

    `<div␊
      data-c="3"␊
      data-b="2"␊
      data-d="4"␊
      data-e="5"␊
      data-e="6"␊
      data-a="1"␊
      id="last">␊
    ␊
      <div>␊
    ␊
        <p␊
          class="x"␊
          id="{{ some.object }}"␊
          data-c="3"␊
          data-b="2"␊
          data-d="4"␊
          data-f="8"␊
          data-e="5"␊
          data-g="9"␊
          data-h-attr="10"␊
          data-h-b-attr="12"␊
          data-h-b-attr="10"␊
          data-i="12"␊
          data-e="7"␊
          data-e="6"␊
          data-a="1">␊
    ␊
          <h1␊
            third␊
            second␊
            fourth␊
            fifth␊
            first></h1>␊
    ␊
        </p>␊
    ␊
      </div>␊
    </div>`

## Force Attribute Indentation

> { markup: { forceAttribute: true } } 

    `<div␊
      id="{{ xxx | filter: 'xxx' }}"␊
      class="{{ foo.bar }}"␊
      data-x="{{ foo.bar }}"␊
      data-condition="{% if x %}foo{% else %}{{ x -}}{% endif %}"></div>␊
    ␊
    <div␊
      id="{{ xxx | filter: 'xxx' }}"></div>␊
    ␊
    <div␊
      id="{{ xxx | filter: 'xxx' }}"␊
      class="{{ foo.bar }}"␊
      data-x="{{ foo.bar }}"␊
      data-condition="{% if x %}foo{% else %}{{ x -}}{% endif %}"␊
      data-xx="{{ foo.bar }}">␊
    ␊
      <div␊
        id="{{ xxx | filter: 'xxx' }}"␊
        class="{{ foo.bar }}"></div>␊
    ␊
      <div␊
        data-xx="x"␊
        id="{{ xxx | filter: 'xxx' }}"␊
        class="{{ foo.bar }}"></div>␊
    ␊
    </div>`

> { markup: { forceAttribute: false } } (default)

    `<div id="{{ xxx | filter: 'xxx' }}" class="{{ foo.bar }}" data-x="{{ foo.bar }}" data-condition="{% if x %}foo{% else %}{{ x -}}{% endif %}"></div>␊
    ␊
    <div id="{{ xxx | filter: 'xxx' }}"></div>␊
    ␊
    <div id="{{ xxx | filter: 'xxx' }}" class="{{ foo.bar }}" data-x="{{ foo.bar }}" data-condition="{% if x %}foo{% else %}{{ x -}}{% endif %}" data-xx="{{ foo.bar }}">␊
    ␊
      <div id="{{ xxx | filter: 'xxx' }}" class="{{ foo.bar }}"></div>␊
    ␊
      <div data-xx="x" id="{{ xxx | filter: 'xxx' }}" class="{{ foo.bar }}"></div>␊
    ␊
    </div>`

## Force Content Indentation

> { markup: { forceIndent: false } } 

    `<ul>␊
      <li>Content will be forced onto newlines</li>␊
      <li>Content will be forced onto newlines</li>␊
      <li>Content will be forced onto newlines</li>␊
      <li>Content will be forced onto newlines</li>␊
    </ul>␊
    ␊
    <div>Content will be forced onto newlines</div>␊
    ␊
    <p>Content will be forced onto newlines␊
    </p>␊
    ␊
    <p>␊
      Content will be forced onto newlines␊
    </p>`

> { markup: { forceIndent: true } } (default)

    `<ul>␊
      <li>␊
        Content will be forced onto newlines␊
      </li>␊
      <li>␊
        Content will be forced onto newlines␊
      </li>␊
      <li>␊
        Content will be forced onto newlines␊
      </li>␊
      <li>␊
        Content will be forced onto newlines␊
      </li>␊
    </ul>␊
    ␊
    <div>␊
      Content will be forced onto newlines␊
    </div>␊
    ␊
    <p>␊
      Content will be forced onto newlines␊
    </p>␊
    ␊
    <p>␊
      Content will be forced onto newlines␊
    </p>`

## Delimiter Spacing

> { markup: { delimiterSpacing: false } } 

    `{{output.name | filter: 'something'}}␊
    {{-output.name | filter: 'something'-}}␊
    {{   output.name | filter: 'something'}}␊
    {{output.name | filter: 'something'       }}␊
    {{             output.name | filter: 'something'␊
    ␊
    -}}␊
    ␊
    {%if x and y%}␊
      Something␊
    {%endif%}␊
    ␊
    {%-if x and y     -%}␊
      Something␊
    {%-    endif-%}␊
    ␊
    {%-  for  x in arr    -%}␊
      <div>␊
        <ul>␊
          <li>␊
            {{   output.name | filter: 'something'}}␊
          </li>␊
        </ul>␊
      </div>␊
    {%endif%}`

> { markup: { delimiterSpacing: true } } (default)

    `{{ output.name | filter: 'something' }}␊
    {{- output.name | filter: 'something' -}}␊
    {{ output.name | filter: 'something' }}␊
    {{ output.name | filter: 'something' }}␊
    {{ output.name | filter: 'something' -}}␊
    ␊
    {% if x and y %}␊
      Something␊
    {% endif %}␊
    ␊
    {%- if x and y -%}␊
      Something␊
    {%- endif -%}␊
    ␊
    {%- for  x in arr -%}␊
      <div>␊
        <ul>␊
          <li>␊
            {{ output.name | filter: 'something' }}␊
          </li>␊
        </ul>␊
      </div>␊
    {% endif %}`

## Quote Convert

> { markup: { quoteConvert: "single" } } 

    '<div class=\'quote-convert\' id=\'xxx\' data-attribute=\'xxxx\'></div>'

> { markup: { quoteConvert: "double" } } 

    '<div class="quote-convert" id="xxx" data-attribute="xxxx"></div>'

> { markup: { quoteConvert: "none" } } (default)

    '<div class="quote-convert" id="xxx" data-attribute="xxxx"></div>'