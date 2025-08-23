# Enhanced Markdown Viewer Test

This document tests the enhanced features of the mdMagic viewer.

## Table of Contents Test

The table of contents should automatically generate based on these headers.

### Third Level Header

This is content under a third-level header.

#### Fourth Level Header

Even deeper nesting should work.

##### Fifth Level Header

Very deep nesting.

###### Sixth Level Header

The deepest level.

## Code Highlighting Test

### JavaScript Code

```javascript
function example() {
  const message = "Hello, world!";
  console.log(message);
  
  // This is a comment
  if (true) {
    return message;
  }
}
```

### TypeScript Code

```typescript
interface User {
  name: string;
  age: number;
}

const user: User = {
  name: "John Doe",
  age: 30
};
```

### HTML Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
</head>
<body>
  <h1>Hello World</h1>
  <p class="greeting">Welcome!</p>
</body>
</html>
```

### CSS Code

```css
.greeting {
  color: blue;
  font-size: 16px;
  background-color: #f0f0f0;
}

body {
  margin: 0;
  padding: 20px;
  font-family: Arial, sans-serif;
}
```

### JSON Code

```json
{
  "name": "mdMagic",
  "version": "1.0.0",
  "description": "VS Code Markdown Extension",
  "main": "extension.js",
  "dependencies": {
    "marked": "^4.0.0",
    "highlight.js": "^11.0.0"
  }
}
```

## Text Formatting Test

This paragraph contains **bold text**, *italic text*, and ***bold italic text***.

You can also use ~~strikethrough text~~ and `inline code`.

## Links and Images Test

Here's a [link to GitHub](https://github.com) that should work.

Here's an image (may not display in VS Code):
![Sample Image](https://via.placeholder.com/150)

## Table Test

| Feature | Status | Priority |
|---------|--------|----------|
| Syntax Highlighting | ✅ Implemented | High |
| Table of Contents | ✅ Implemented | High |
| Theme Support | ✅ Implemented | Medium |
| Print Styling | ✅ Implemented | Medium |

## List Test

### Unordered List

- First item
- Second item
  - Nested item
  - Another nested item
- Third item

### Ordered List

1. First step
2. Second step
   1. Sub-step A
   2. Sub-step B
3. Third step

## Blockquote Test

> This is a blockquote.
> It can span multiple lines.
> 
> And have multiple paragraphs.

## Print Test

When you print this document (Ctrl+P or the print button), the styling should be optimized for print with:

- Hidden toolbar and table of contents
- Black text on white background
- Proper page breaks
- URLs shown after links

## Theme Test

Use the theme button (🎨) in the toolbar to test theme switching between:

- Default theme
- Dark theme  
- Light theme
- High contrast theme

The themes should switch smoothly without affecting functionality.