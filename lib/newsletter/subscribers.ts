export type SubscriberLookup = {
  findUnique(args: {
    select: {
      id: true;
    };
    where: {
      email: string;
    };
  }): Promise<{ id: string } | null>;
};

export type SubscriberSignupResult =
  | {
      email: string;
      message: "You are on the list.";
      status: "new";
    }
  | {
      message: "That email is already subscribed.";
      status: "duplicate";
    }
  | {
      message: "Enter a valid email address.";
      status: "invalid";
    };

export async function getSubscriberSignupResult(
  email: string | null,
  subscribers: SubscriberLookup,
): Promise<SubscriberSignupResult> {
  if (!email) {
    return {
      message: "Enter a valid email address.",
      status: "invalid",
    };
  }

  const existingSubscriber = await subscribers.findUnique({
    select: {
      id: true,
    },
    where: {
      email,
    },
  });

  if (existingSubscriber) {
    return {
      message: "That email is already subscribed.",
      status: "duplicate",
    };
  }

  return {
    email,
    message: "You are on the list.",
    status: "new",
  };
}
