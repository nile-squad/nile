import jwt from 'jsonwebtoken';

const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
const tokenRefresh = process.env.REFRESH_TOKEN_SECRET;

if (!(tokenSecret && tokenRefresh)) {
  throw new Error(
    'ACCESS_TOKEN_SECRET or REFRESH_TOKEN_SECRET is not defined in the environment.'
  );
}

export const generateTokens = (user: any) => {
  const accessToken = jwt.sign({ user }, tokenSecret, {
    expiresIn: '2h',
  });

  const refreshToken = jwt.sign({ user }, tokenRefresh, {
    expiresIn: '30h',
  });

  return { accessToken, refreshToken };
};

export const verifyToken = async (token: string): Promise<any> => {
  const tryVerify = (secret: string) =>
    new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err, decoded) => {
        if (err) {
          return reject(err);
        }
        resolve(decoded);
      });
    });

  try {
    return await tryVerify(tokenSecret);
  } catch {
    try {
      return await tryVerify(tokenRefresh);
    } catch (err: any) {
      throw new Error(`Token verification failed: ${err.message}`);
    }
  }
};

export const checkExpiration = (expirationUnixTimestamp: number): boolean => {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return expirationUnixTimestamp < currentTimestamp;
};

export const decodeToken = (token: string): any => {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};
