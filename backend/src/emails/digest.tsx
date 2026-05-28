import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import type { DigestOutput } from '../services/llm.js';

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

interface DigestEmailProps {
  digest: DigestOutput;
  date: string;
  articleCount: number;
}

export function DigestEmail({ digest, date, articleCount }: DigestEmailProps) {
  const previewText = digest.articles[0]?.title
    ? `${digest.articles[0].title} — and ${articleCount - 1} more`
    : `Your ReadLater digest — ${articleCount} article${articleCount === 1 ? '' : 's'}`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Text style={styles.brand}>TLDR DIGEST</Text>
            <Text style={styles.dateLine}>{date}</Text>
          </Section>

          <Hr style={styles.topDivider} />

          {/* Articles */}
          {digest.articles.map((article, i) => (
            <Section key={article.url} style={styles.article}>
              <Heading as="h2" style={styles.articleTitle}>
                <Link href={article.url} style={styles.titleLink}>
                  {article.title}
                </Link>
              </Heading>

              <Text style={styles.summary}>{article.summary}</Text>

              {article.keyPoints.length > 0 && (
                <Section style={styles.keyPoints}>
                  {article.keyPoints.map((point, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static render, no reordering
                    <Text key={j} style={styles.keyPoint}>
                      · {point}
                    </Text>
                  ))}
                </Section>
              )}

              <Link href={article.url} style={styles.readMore}>
                Read original →
              </Link>

              {i < digest.articles.length - 1 && <Hr style={styles.divider} />}
            </Section>
          ))}

          {/* Footer */}
          <Hr style={styles.topDivider} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              {articleCount} article{articleCount === 1 ? '' : 's'} from your queue · TLDR Digest
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#ffffff',
    fontFamily: FONT_STACK,
    margin: '0',
    padding: '0',
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '40px 32px',
  },
  header: {
    textAlign: 'center' as const,
    paddingBottom: '8px',
  },
  brand: {
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '4px',
    color: '#111111',
    margin: '0 0 6px 0',
    textTransform: 'uppercase' as const,
  },
  dateLine: {
    fontSize: '13px',
    color: '#888888',
    margin: '0',
  },
  topDivider: {
    borderColor: '#e5e5e5',
    margin: '24px 0',
  },
  article: {
    paddingBottom: '4px',
  },
  articleTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#111111',
    lineHeight: '1.3',
    margin: '0 0 12px 0',
  },
  titleLink: {
    color: '#111111',
    textDecoration: 'none',
  },
  summary: {
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#444444',
    margin: '0 0 16px 0',
  },
  keyPoints: {
    paddingLeft: '4px',
    marginBottom: '16px',
  },
  keyPoint: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#555555',
    margin: '0 0 4px 0',
  },
  readMore: {
    fontSize: '13px',
    color: '#888888',
    textDecoration: 'none',
  },
  divider: {
    borderColor: '#f0f0f0',
    margin: '28px 0',
  },
  footer: {
    textAlign: 'center' as const,
  },
  footerText: {
    fontSize: '12px',
    color: '#aaaaaa',
    margin: '0',
  },
};
