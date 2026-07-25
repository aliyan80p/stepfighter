import * as React from 'react'
import { Img, Section, Text } from '@react-email/components'

// Public CDN URL for the StepFighter logo (Lovable asset infrastructure serves
// this at any project domain; email clients fetch it directly).
export const LOGO_URL =
  'https://stepfighter.com/__l5e/assets-v1/ffb3450b-16d8-4739-80cd-5e50c1316d8a/stepfighter-logo.png'

export const BrandHeader = () => (
  <Section style={wrap}>
    <Img
      src={LOGO_URL}
      alt="StepFighter"
      width="56"
      height="56"
      style={img}
    />
    <Text style={name}>StepFighter</Text>
  </Section>
)

const wrap = { textAlign: 'center' as const, padding: '4px 0 20px' }
const img = { display: 'inline-block', margin: '0 auto', borderRadius: '8px' }
const name = {
  fontSize: '16px',
  fontWeight: 'bold' as const,
  color: '#1e3a8a',
  margin: '8px 0 0',
  textAlign: 'center' as const,
}
