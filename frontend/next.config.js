/** @type {import('next').NextConfig} */
const nextConfig = {
    turbopack: {},
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "gateway.pinata.cloud",
                pathname: "/ipfs/**",
            },
        ],
    },
};

export default nextConfig;
