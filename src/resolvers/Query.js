const { forwardTo } = require("prisma-binding");

const Query = {
  games: forwardTo("db"),
  me(parent, args, ctx, info) {
    if (!ctx.request.userId) return null;
    return ctx.db.query.user(
      {
        where: { id: ctx.request.userId }
      },
      info
    );
  },
  usersByUsername(parent, { searchValue }, ctx, info) {
    return ctx.db.query.users(
      {
        where: {
          username_contains: searchValue
        }
      },
      info
    );
  }
};

module.exports = Query;
