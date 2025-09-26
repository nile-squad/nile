# Agentic AI Specification

**Version:** 2.0  
**Date:** August 18, 2025  
**Author:** Hussein Kizz

A natural language interface for the Delta Backend platform that enables users to interact with backend services through conversational AI. Provides:

- Natural language to backend service translation
- Conversational memory and context awareness
- Tool-assisted operation execution
- Multi-turn dialogue support
- Service discovery and exploration
- Error recovery and user guidance

## 1. Core Concepts

### 1.1 Purpose

The agentic system bridges the gap between human language and backend operations, allowing users to:

- Discover available services without technical knowledge
- Execute complex workflows through simple requests
- Get contextual help and guidance
- Maintain conversation flow across multiple interactions

### 1.2 Interaction Flow

```
User Input → Intent Understanding → Service Discovery → Tool Selection → Execution → Response
```

### 1.3 Usage Patterns

**Service Discovery:**

- "What can I do with user accounts?"
- "Show me available messaging options"

**Data Operations:**

- "Get recent user registrations"
- "Find accounts created this month"

**Task Execution:**

- "Create an account for <john@email.com>"
- "Send welcome message to new users"

**Analysis & Reporting:**

- "Summarize user activity patterns"
- "Generate monthly usage report"

## 2. Authentication Architecture

### 2.1 User-Triggered Agent Operations

**Authenticated Agentic Endpoint:**
All agent interactions require user authentication to ensure proper context and permissions:

```bash
curl -X POST http://localhost:8000/Delta/api/v1/services/agentic \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=SESSION_TOKEN" \
  -d '{
    "action": "agent",
    "payload": {
      "input": "Create a customer for john@example.com"
    }
  }'
```

**Why User Authentication is Required:**

- Ensures agent operations are performed within user's organization context
- Maintains audit trail of who triggered agent actions
- Enforces user permissions and access controls
- Prevents unauthorized access to organizational data

### 2.2 Context Propagation Flow

**Authentication Context Inheritance:**

```
1. User authenticates at agentic endpoint
   ↓ Better Auth session validation
   ↓ Extract user_id and organization_id
   
2. Agent handler receives authenticated context
   ↓ User context: { user_id, organization_id }
   ↓ Agent inherits user's organizational scope
   
3. Agent RPC operations
   ↓ createRPC({ agentMode: true, organization_id })
   ↓ All service calls execute with user context
   
4. Service execution
   ↓ Automatic context injection
   ↓ Operations performed as triggering user
```

**Implementation Example:**

```typescript
const agenticHandler = async (payload: { 
  input: string; 
  user_id: string; 
  organization_id: string; 
}) => {
  // Agent inherits user's organizational context
  const rpc = createRPC({
    agentMode: true,
    organization_id: payload.organization_id,
    user_id: payload.user_id
  });
  
  // All agent operations tracked with triggering user
  const result = await rpc.executeServiceAction('customers', {
    action: 'create',
    payload: {
      name: extractNameFromInput(payload.input),
      email: extractEmailFromInput(payload.input)
      // user_id, organization_id automatically injected
    }
  });
  
  return `Created customer: ${result.data?.name}`;
};
```

### 2.3 Agent Security Model

**Multi-Layer Security:**

1. **Endpoint Authentication** - User must be authenticated to trigger agent
2. **Context Isolation** - Agent operations scoped to user's organization
3. **Action Restrictions** - Certain actions can be blocked from agent access
4. **Audit Trail** - All agent operations logged with triggering user

**Agent Action Controls:**

```typescript
// Block destructive operations from agent access
{
  name: 'deleteAllCustomers',
  agentic: false,  // Prevents agent execution
  handler: destructiveOperation
}

// Allow agent access (default behavior)
{
  name: 'createCustomer',
  agentic: true,   // Explicitly allow (optional)
  handler: createHandler
}
```

## 3. System Architecture

### 3.1 Design Philosophy

**Why Natural Language Interface?**

- Reduces learning curve for non-technical users
- Enables self-service operations without API knowledge  
- Provides contextual guidance and error recovery
- Allows complex multi-step workflows through conversation

**Why Tool-Based Approach?**

- Maintains separation between AI reasoning and business logic
- Enables controlled access to backend services
- Provides predictable and auditable operations
- Allows for gradual capability expansion

**Why User Authentication Required?**

- Ensures operations are performed within proper organizational context
- Maintains security boundaries and access controls
- Provides audit trail for all agent-triggered operations
- Prevents unauthorized cross-tenant data access

### 3.2 Conversation Model

**Session-Based Interactions:**

- Each user maintains isolated conversation context
- History preserved for contextual understanding
- Automatic cleanup to prevent memory bloat
- Cross-session learning disabled for privacy

**Multi-Turn Capability:**

```
User: "Show me user accounts"
Agent: [displays accounts] "Found 150 accounts. Would you like to filter by date or status?"
User: "Show only active ones from this month"
Agent: [applies filters] "Here are 23 active accounts from this month..."
```

## 4. Tool Ecosystem

### 4.1 Tool Categories

**Discovery Tools** - Understanding available capabilities

- Service enumeration and exploration
- Schema introspection and documentation
- Capability mapping and recommendations

**Execution Tools** - Performing backend operations  

- Service action execution with validation
- Parameter transformation and formatting
- Result processing and presentation

**Analysis Tools** - Processing and summarizing data

- Data aggregation and statistical analysis
- Trend identification and reporting
- Comparative analysis across time periods

### 4.2 Tool Selection Strategy

The system chooses tools based on:

1. **Intent Classification** - What the user wants to accomplish
2. **Context Awareness** - Previous conversation and available data
3. **Service Availability** - What backend services are accessible
4. **User Permissions** - What operations the user can perform

### 4.3 Authenticated Tool Execution

**Tool Context Inheritance:**
All tools inherit the authenticated user's context automatically:

```typescript
// Tool receives user context from authentication
const toolHandler = async (params: any, context: { user_id: string; organization_id: string }) => {
  const rpc = createRPC({
    agentMode: true,
    organization_id: context.organization_id,
    user_id: context.user_id
  });
  
  // Tool operations execute with user permissions
  return await rpc.executeServiceAction('target-service', {
    action: params.action,
    payload: params.data
  });
};
```

## 5. Operational Flow

### 5.1 Intent Recognition

- Parse natural language for actionable requests
- Identify target services and required operations
- Determine information needs vs. action requests

### 5.2 Service Resolution

- Map user intent to available backend services
- Validate permissions and access controls
- Identify required parameters and data sources

### 5.3 Execution Planning

- Select appropriate tools for the request
- Plan execution order for multi-step operations
- Prepare fallback strategies for errors

### 5.4 Result Synthesis

- Process tool outputs into coherent responses
- Format data for human consumption
- Provide context and next-step suggestions

## 6. Memory & Context

### 6.1 Conversation Memory

**Why Session-Based Memory?**

- Enables contextual follow-up questions
- Reduces repetitive parameter entry
- Allows refinement of previous requests
- Maintains workflow continuity

**Memory Boundaries:**

- Limited to single conversation session
- No cross-user data sharing
- Automatic expiration for privacy
- Reset capability for fresh starts

### 6.2 Context Types

**Immediate Context** - Current conversation turn  
**Session Context** - Full conversation history  
**Service Context** - Available operations and schemas
**User Context** - Authenticated user permissions and organization access

**Authentication Context Persistence:**

```typescript
// User context maintained throughout session
const sessionContext = {
  user_id: 'authenticated-user-uuid',
  organization_id: 'user-org-uuid',
  permissions: ['create', 'read', 'update'],
  conversation_history: [...],
  available_services: [...]
};
```

## 7. Error Handling Philosophy

### 7.1 Graceful Degradation

**When Services are Unavailable:**

- Inform user of current limitations
- Suggest alternative approaches
- Provide manual operation guidance

**When Requests are Ambiguous:**

- Ask clarifying questions
- Offer multiple interpretation options
- Guide toward successful completion

**When Permissions are Insufficient:**

- Explain access limitations clearly
- Suggest who to contact for access
- Offer alternative operations within permissions

**When Authentication Fails:**

- Prompt user to re-authenticate
- Explain authentication requirements
- Guide to proper login process

### 7.2 User Guidance Strategy

**Proactive Help:**

- Suggest related operations after successful completion
- Offer shortcuts for common workflows
- Provide examples of successful requests

**Error Recovery:**

- Explain what went wrong in user terms
- Suggest corrected versions of failed requests
- Offer step-by-step guidance for complex operations

## 8. Integration Approach

### 8.1 Backend Service Integration

**Why RPC Interface?**

- Consistent access pattern across all services
- Built-in validation and error handling
- Service discovery and introspection capabilities
- Standardized response formats

**Service Discovery Flow:**

1. User expresses intent in natural language
2. System identifies relevant service categories
3. Dynamic discovery of available services and actions
4. Intent mapping to specific service operations
5. Parameter collection and validation
6. Execution and result formatting

### 8.2 Authentication & Authorization

**Agent Mode Operation with User Context:**

- User authentication required at agentic endpoint
- User context extracted and passed to agent
- System-level access to backend services with user scope
- User context passed for permission checking
- Audit trail for all operations with triggering user
- Scope limitation to user's organization

**Authentication Flow:**

```typescript
// 1. User authenticates at agentic endpoint
const authenticatedRequest = {
  headers: { Cookie: 'better-auth.session_token=...' },
  body: { action: 'agent', payload: { input: 'user request' } }
};

// 2. Extract user context from authentication
const userContext = await validateSession(authenticatedRequest);
// userContext = { user_id: '...', organization_id: '...' }

// 3. Agent operations inherit user context
const agentRPC = createRPC({
  agentMode: true,
  organization_id: userContext.organization_id,
  user_id: userContext.user_id
});

// 4. All agent service calls execute with user permissions
const result = await agentRPC.executeServiceAction('service', {
  action: 'operation',
  payload: data  // user_id, organization_id auto-injected
});
```

## 9. Usage Scenarios

### 9.1 Self-Service Operations

**Account Management:**

- "Create a new account for our sales team member"
- "Deactivate accounts for users who haven't logged in for 6 months"
- "Update email address for user John Smith"

**Data Exploration:**

- "What's our user growth rate this quarter?"
- "Show me accounts by registration source"
- "Which features are most popular among our users?"

**Operational Tasks:**

- "Send password reset emails to all flagged accounts"
- "Generate compliance report for audit team"
- "Archive old messages from inactive users"

### 9.2 Learning & Discovery

**Service Exploration:**

- "What can I do with user data?"
- "How do I set up automated messaging?"
- "What reporting options are available?"

**Workflow Guidance:**

- "Walk me through creating a marketing campaign"
- "What's the process for handling user complaints?"
- "How do I analyze user engagement metrics?"

## 10. Design Decisions

### 10.1 Why Natural Language Over GUI?

**Advantages:**

- Faster for experienced users who know what they want
- Self-documenting through conversation history
- Handles edge cases and variations gracefully
- Reduces cognitive load for complex multi-step operations

**Trade-offs:**

- Requires AI infrastructure and ongoing costs
- Less predictable than traditional interfaces
- Potential for misinterpretation of user intent
- Learning curve for users unfamiliar with conversational interfaces

### 10.2 Why Session-Based vs. Stateless?

**Session Benefits:**

- Contextual follow-up questions work naturally
- Reduces redundant parameter entry
- Enables workflow refinement and iteration
- Better user experience for multi-step processes

**Session Limitations:**

- Memory overhead for concurrent users
- Complexity in session management and cleanup
- Potential privacy concerns with conversation storage
- Challenges in scaling across multiple server instances

### 10.3 Why Tool-Based vs. Direct Integration?

**Tool Approach Benefits:**

- Clear separation between AI reasoning and business logic
- Controlled and auditable access to backend services
- Easier to test and validate individual capabilities
- Gradual rollout of new features and services

**Alternative Considerations:**

- Direct service integration would be simpler to implement
- Could provide more sophisticated parameter handling
- Might enable better error recovery and validation
- Would reduce the abstraction layer overhead

### 10.4 Why User Authentication Required?

**Security Benefits:**

- Ensures operations are performed within proper organizational boundaries
- Maintains audit trail with actual user identification
- Prevents unauthorized cross-tenant data access
- Enables proper permission checking and access control

**User Experience Benefits:**

- Agent actions appear in user's activity history
- Consistent organization context across manual and agent operations
- Proper data isolation and privacy protection
- Clear responsibility and accountability for agent actions

## 11. Operational Considerations

### 11.1 Performance Characteristics

**Response Times:**

- Simple queries: 1-3 seconds
- Complex multi-tool operations: 3-10 seconds
- Large data analysis: 10-30 seconds

**Scalability Factors:**

- AI model API rate limits and costs
- Backend service capacity and response times
- Session storage and memory management
- Concurrent user conversation handling

### 11.2 Monitoring & Observability

**Key Metrics:**

- User satisfaction with AI responses
- Tool execution success rates
- Service availability and response times
- Conversation completion rates

**Error Tracking:**

- Failed tool executions and root causes
- Unhandled user intents and edge cases
- Service integration failures
- User abandonment points in conversations

## 12. Limitations & Constraints

### 12.1 Current Limitations

**Functional Constraints:**

- No cross-session learning or personalization
- Limited to available backend services
- No proactive notifications or monitoring
- Single-user sessions only (no collaboration)

**Technical Constraints:**

- Dependent on external AI service availability
- Session memory limited to prevent resource exhaustion
- Tool execution timeouts for long-running operations
- No offline capability or local AI processing

**Security Constraints:**

- Requires user authentication for all operations
- Limited to user's organizational data scope
- Cannot perform cross-tenant operations
- Subject to same permission restrictions as authenticated user

### 12.2 Future Enhancement Opportunities

**User Experience:**

- Proactive assistance based on usage patterns
- Multi-modal interaction (voice, visual)
- Collaborative sessions for team operations
- Integration with notification systems

**Capabilities:**

- Advanced analytics and predictive insights
- Workflow automation and scheduling
- Custom tool development by users
- Integration with external data sources

**Technical:**

- Local AI model deployment options
- Advanced session persistence and recovery
- Multi-agent coordination for complex tasks
- Real-time collaboration features

**Security:**

- Fine-grained permission delegation for agents
- Temporary elevated access with approval workflows
- Cross-organizational operations with proper authorization
- Advanced audit and compliance features

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz

*This specification reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*
