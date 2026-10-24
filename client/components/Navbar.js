'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';

export default function Navbar() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { cart } = useCart();

  function handleLogout() {
    logout();
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-green-700">
          FreshCart
        </Link>

            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm sm:gap-x-5">
                    <Link href="/" className="hover:text-green-700">
            Products
          </Link>

                   <Link href="/ai" className="hover:text-green-700">
            AI List
          </Link>

          {user && (
            <Link href="/restock" className="hover:text-green-700">
              Restock
            </Link>
          )}

          <Link href="/cart" className="relative hover:text-green-700">
            Cart
            {cart.itemCount > 0 && (
              <span className="ml-1 rounded-full bg-green-700 px-1.5 py-0.5 text-xs text-white">
                {cart.itemCount}
              </span>
            )}
          </Link>

                    {loading ? null : user ? (
            <>
              <Link href="/orders" className="hover:text-green-700">
                Orders
              </Link>
              <span className="hidden text-gray-600 sm:inline">Hi, {user.name.split(' ')[0]}</span>
              <button
                onClick={handleLogout}
                className="rounded border px-3 py-1 hover:bg-gray-100"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-green-700">
                Login
              </Link>
              <Link
                href="/register"
                className="rounded bg-green-700 px-3 py-1 text-white hover:bg-green-800"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}