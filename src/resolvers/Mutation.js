const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { promisify } = require("util");
const { transport, makeANiceEmail } = require("../mail");

const mutations = {
  async createGame(parent, args, ctx, info) {
    if (!ctx.request.userId) {
      throw new Error(`You must be logged in to do that.`);
    }
    const playerIds = args.players.map(player => player.id);
    const users = await ctx.db.query.users({
      where: {
        id_in: playerIds
      }
    });

    const scrubbedUserData = users.map(user => ({
      id: user.id,
      email: user.email
    }));

    const game = await ctx.db.mutation.createGame(
      {
        data: {
          ...args,
          createdBy: {
            connect: {
              id: ctx.request.userId
            }
          },
          players: {
            connect: scrubbedUserData
          }
        }
      },
      info
    );

    return game;
  },
  async createGameEvent(parent, args, ctx, info) {
    const event = await ctx.db.mutation.createGameEvent(
      {
        data: {
          type: args.type,
          game: {
            connect: {
              id: args.gameId
            }
          }
        }
      },
      info
    );
    // 3. return event

    return event;
  },
  async updateGame(parent, args, ctx, info) {
    return await ctx.db.mutation.updateGame(
      {
        data: {
          name: args.name
        },
        where: {
          id: args.id
        }
      },
      info
    );
  },
  async signup(parent, args, ctx, info) {
    args.email = args.email.toLowerCase();
    const password = await bcrypt.hash(args.password, 10);
    const user = await ctx.db.mutation.createUser(
      {
        data: {
          ...args,
          password,
          permissions: { set: ["USER"] }
        }
      },
      info
    );

    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });

    return user;
  },
  async signin(parent, { email, password }, ctx, info) {
    // 1. Check if user exists
    const user = await ctx.db.query.user({ where: { email } });
    if (!user) {
      throw new Error(`No such user found for email: ${email}`);
    }
    // 2. Check if password is accurate
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error(`Invalid password`);
    }
    // 3. Generate JWT token, set cookie
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });

    // 4. Return user
    return user;
  },
  signout(parent, args, ctx, info) {
    ctx.response.clearCookie("token");
    return { message: "Goodbye!" };
  },
  async requestReset(parent, { email }, ctx, info) {
    // 1. Check if this is a real user
    const user = await ctx.db.query.user({ where: { email } });
    if (!user) {
      throw new Error(`No such user found for email: ${email}`);
    }
    // 2. Set a reset token and expiry on that user
    const promisifiedRandomBytes = promisify(randomBytes);
    const resetToken = (await promisifiedRandomBytes(20)).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour
    const res = await ctx.db.mutation.updateUser({
      where: { email },
      data: { resetToken, resetTokenExpiry }
    });
    const mailRes = await transport.sendMail({
      from: "twwaneka@gmail.com",
      to: user.email,
      subject: "Your Password Reset Token",
      html: makeANiceEmail(
        `Your password reset token is here! \n\n <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">Click here to reset</a>`
      )
    });

    return { message: "Thanks" };
  },
  async resetPassword(parent, { password, resetToken }, ctx, info) {
    // 1. Check if it's a legit reset token
    // 2. Check if it's expired
    const [user] = await ctx.db.query.users({
      where: {
        resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000
      }
    });
    // const user = users[0];
    if (!user) {
      throw new Error(`This token is either invalid or expired`);
    }
    // 3. Hash new password
    const newPassword = await bcrypt.hash(password, 10);
    // 4. Save new password to user & remove old reset token fields
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password: newPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });
    // 5. Generate JWT
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);
    // 6. Set new JWT cookie
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });
    // 7. return updated user
    return updatedUser;
  }
};

module.exports = mutations;
