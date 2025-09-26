# Documentation Rules and Formatting Conventions

**Version:** 1.0  
**Date:** August 13, 2025  
**Author:** Hussein Kizz

This document establishes the formatting and style conventions for all specification and documentation files in this project.

## 1. File Structure

### 1.1 Header Format

All specification documents MUST start with this exact header format:

```markdown
# [Document Title]

**Version:** [X.Y]  
**Date:** [Month DD, YYYY]  
**Author:** [Author Name]

[Document content starts here...]
```

### 1.2 Section Numbering

- Use numbered sections starting with `## 1. Overview`
- Use numbered subsections like `### 1.1 Subsection Title`
- Continue numbering sequentially throughout the document
- Avoid skipping numbers or using letters (e.g., avoid `1.a`, use `1.1` instead)

### 1.3 Document Footer

End documents with author attribution and evolution note:

```markdown
**Author:** [Author Name with link if applicable]

*This specification reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*
```

## 2. Formatting Rules

### 2.1 Horizontal Lines

- **AVOID** unnecessary horizontal lines (`---`)
- Only use horizontal lines sparingly for major document breaks
- Section headers provide sufficient visual separation

### 2.2 Code Blocks

- Always include proper language identifier for syntax highlighting
- Add one blank line before AND after each code block
- Use consistent indentation within code blocks

**Correct:**

```markdown
Here is some text.
```

```json
{
  "example": "value"
}
```

**Incorrect:**

```markdown
Here is some text.
```json
{
  "example": "value"  
}
```
```
More text continues here.
```

### 2.3 Lists and Bullets

- Use consistent bullet points (`-` for unordered lists)
- Use numbered lists (`1.`, `2.`, etc.) for sequential steps
- Maintain consistent indentation for nested lists
- Add blank line before and after lists when they follow paragraphs

### 2.4 Emphasis and Formatting

- Use **bold** for important terms, field names, and emphasis
- Use `code formatting` for:
  - API endpoints
  - Function names
  - Variable names
  - File paths
  - Technical terms
- Use *italics* sparingly, only for subtle emphasis

## 3. Content Guidelines

### 3.1 Language and Tone

- Use professional, technical language
- Write in present tense
- Be concise and direct
- Avoid casual language, slang, or colloquialisms
- **NO EMOJIS** unless explicitly requested for non-specification documents

### 3.2 Technical Accuracy

- All code examples MUST work with the actual implementation
- Reference actual function names, not hypothetical ones
- Test all endpoints and examples before including them
- Verify all parameter names and types

### 3.3 Examples and Code Samples

- Include realistic, working examples
- Use consistent naming conventions in examples
- Provide both request and response examples for API endpoints
- Show error cases alongside success cases

## 4. Specific Formatting Rules

### 4.1 API Documentation

**Endpoint Format:**

```markdown
**Endpoint:** `[METHOD] /path/to/endpoint`

[Description of what the endpoint does]

**Request Example:**
```bash
curl -X [METHOD] [URL] \
  -H "Content-Type: application/json" \
  -d '[JSON_PAYLOAD]'
```

**Response Example:**

```json
{
  "status": true,
  "message": "Success message",
  "data": {}
}
```

### 4.2 Configuration Examples

- Always show complete, realistic configuration objects
- Include comments where helpful for clarity
- Use TypeScript types when showing configuration schemas

### 4.3 Property Documentation

Use this format for documenting object properties:

```markdown
- **`propertyName`**: Description of what this property does
- **`anotherProperty`**: Another description with `code formatting` for values
```

## 5. File Organization

### 5.1 Naming Conventions

- Use kebab-case for file names (e.g., `rest-rpc.spec.md`)
- Use descriptive names that indicate file purpose
- Add `.spec.` for specification documents
- Add `.faq.` for FAQ documents
- Add `.rules.` or `.conventions.` for guideline documents

### 5.2 Cross-References

- Use relative paths for internal links
- Reference line numbers when pointing to specific code: `file_path:line_number`
- Include proper markdown links with descriptive text

## 6. Quality Standards

### 6.1 Review Checklist

Before finalizing any specification document, verify:

- [ ] Header follows exact format with version, date, author
- [ ] All sections are properly numbered
- [ ] No unnecessary horizontal lines
- [ ] Code blocks have proper spacing and language tags
- [ ] All examples are tested and working
- [ ] No emojis or casual language
- [ ] Footer includes author attribution
- [ ] Cross-references are accurate
- [ ] Formatting is consistent throughout

### 6.2 Version Control

- Increment version numbers for significant changes
- Update dates when making revisions
- Maintain backward compatibility in specifications
- Document breaking changes clearly

## 7. Implementation Notes

### 7.1 Tool Integration

These rules are designed to work with:

- Standard markdown parsers
- GitHub-flavored markdown
- Documentation generation tools
- Code review processes

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz

*This documentation standard reflects current best practices and is subject to evolution. Contributions and feedback are welcome.*
