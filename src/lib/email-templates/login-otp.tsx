import * as React from 'react'
import { BrandHeader } from './brand-header'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  code: string
  minutes?: number
}

const Email = ({ code, minutes = 10 }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your StepFighter sign-in code is {code}</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={h1}>Your sign-in code</Heading>
        <Text style={text}>
          Use this code to finish signing in to StepFighter. It expires in {minutes} minutes.
        </Text>
        <div style={codeBox}>{code}</div>
        <Text style={footer}>
          If you didn't try to sign in, you can safely ignore this email — your account is still secure.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Your StepFighter sign-in code: ${d.code}`,
  displayName: 'Login 2FA Code',
  previewData: { code: '482913', minutes: 10 },
} satisfies TemplateEntry

export default Email

const navy = '#1e3a8a'
const amber = '#f59e0b'
const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', borderTop: `4px solid ${amber}`, maxWidth: '480px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: navy, margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 20px' }
const codeBox = {
  fontSize: '34px',
  fontWeight: 'bold' as const,
  color: navy,
  letterSpacing: '10px',
  textAlign: 'center' as const,
  padding: '18px',
  border: `2px dashed ${amber}`,
  borderRadius: '10px',
  margin: '8px 0 24px',
  fontFamily: 'monospace',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
