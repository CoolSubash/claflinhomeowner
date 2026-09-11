/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This repo's CLAUDE.md is the authoritative project spec (see the repo
  // root) - disable Next.js's own auto-generated frontend/CLAUDE.md +
  // AGENTS.md so there's never a second, unrelated file with that name.
  agentRules: false,
};

module.exports = nextConfig;
