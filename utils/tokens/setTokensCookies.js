const setTokensCookies = (res, accessToken, refreshToken) => {
  //console.log("🍪 Setting cookies with maxAge values:", {
  //   accessTokenMaxAge,
  //   refreshTokenMaxAge
  // });

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });

  res.cookie("is_auth", true, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
  });
};

export { setTokensCookies };